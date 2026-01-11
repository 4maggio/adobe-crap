const { entrypoints } = require("uxp");
const { app, FitOptions } = require("indesign");
const fs = require("uxp").storage.localFileSystem;

// Bump this when debugging UI caching/reload issues
const BUILD_ID = "2026-01-11-UI-INIT-2";

// In UXP, DOMContentLoaded can be unreliable depending on panel lifecycle.
// We initialize from both DOMContentLoaded and entrypoints.show(), guarded to run once.
let panelInitialized = false;

function safeInitPanel(source) {
  if (panelInitialized) return;
  try {
    initPanel();
    panelInitialized = true;
    try {
      appendLog(`UI: initPanel via ${source}`);
    } catch (_) {
      // ignore
    }
  } catch (e) {
    console.error(e);
    try {
      appendLog(`Init Fehler: ${e && e.message ? e.message : String(e)}`);
    } catch (_) {
      // ignore
    }
  }
}

// Storage für Templates (UXP File System API)
const STORAGE_FILENAME = "templates.json";
const SETTINGS_FILENAME = "settings.json";
const LOG_LIMIT = 200;
const MIN_DIMENSION = 0.1; // Minimale Breite/Höhe in mm
const MAX_DIMENSION = 10000; // Maximale Breite/Höhe in mm
const logBuffer = [];

// Storage Helper für File System API
let pluginDataFolder = null;

async function getPluginDataFolder() {
  if (!pluginDataFolder) {
    pluginDataFolder = await fs.getDataFolder();
  }
  return pluginDataFolder;
}

// Multi-Format System
let definedFormats = [];
let editFormatIndex = null;

// ============================
// Settings + i18n
// ============================

const DEFAULT_SETTINGS = {
  language: "de",
  logEnabled: true,
  popupsEnabled: true,
  formats: [],
  ui: {
    font: 11,
    gap: 8,
    pad: 12,
    divider: 16
  }
};

let pluginSettings = { ...DEFAULT_SETTINGS };
let settingsReady = false;

const I18N = {
  de: {
    "tabs.resize": "Größenzuweisung",
    "tabs.distribute": "Verteilen",
    "tabs.distributeScale": "Verteilen & Skalieren",
    "tabs.tools": "Tools",
    "tabs.settings": "Einstellungen",

    "title.templates": "Templates",
    "title.formatDefinition": "Formatdefinition",
    "title.sizeConstraints": "Größenbeschränkungen",
    "title.multiFormats": "Mehrere Formate (nur bei Multi-Modus verwendet)",
    "title.plugin": "Plugin",
    "help.distribute": "Verteilt ausgewählte Elemente gleichmäßig auf dem Druckbogen mit gleichen Abständen zwischen allen Elementen und zu den Seitenrändern.",
    "help.distributeScale": "Verteilt und skaliert ausgewählte Elemente, um die gesamte Seite mit definierten Abständen zu füllen.",
    "help.tools": "Zusätzliche Werkzeuge für die Arbeit mit Rahmen und Inhalten.",
    "help.centerContent": "Zentriert den Inhalt (Grafiken) in den ausgewählten Rahmen.",
    "title.centerContent": "Inhalt zentrieren",
    "title.fitToFrame": "An Rahmen anpassen",

    "settings.showLog": "Logfenster anzeigen",
    "settings.showPopups": "Popups anzeigen",
    "settings.language": "Sprache",
    "settings.language.de": "Deutsch",
    "settings.language.en": "Englisch",

    "btn.apply": "Anwenden",
    "btn.saveTemplate": "Template speichern",
    "btn.delete": "Löschen",
    "btn.distribute": "Verteilen",
    "btn.distributeScale": "Verteilen & Skalieren",
    "btn.centerContent": "Inhalt zentrieren",
    "btn.fitToFrame": "An Rahmen anpassen",
    "btn.copyLog": "Log kopieren",
    "btn.clearLog": "Log löschen",
    "btn.addFormat": "Format hinzufügen",
    "btn.updateFormat": "Format aktualisieren",
    "btn.cancel": "Abbrechen",
    "btn.clearFormats": "Alle löschen",

    "tooltip.lockRatio": "Proportionen sperren: Wenn aktiv, reicht Breite oder Höhe.",
    "tooltip.applyResize": "Wendet die Zielgröße auf die Auswahl an.",
    "tooltip.applyDistribute": "Verteilt die Auswahl gleichmäßig.",
    "tooltip.applyDistributeScale": "Verteilt und skaliert die Auswahl auf den Verteilungsbereich.",
    "tooltip.centerContent": "Zentriert Grafiken innerhalb der ausgewählten Rahmen.",
    "tooltip.fitToFrame": "Passt Inhalt an den Rahmen an (je nach Modus).",
    "tooltip.copyLog": "Kopiert das Log in die Zwischenablage.",
    "tooltip.clearLog": "Leert das Log.",

    "tooltip.formatWidth": "Format-Breite (mm) für den Multi-Modus.",
    "tooltip.formatHeight": "Format-Höhe (mm) für den Multi-Modus.",
    "tooltip.formatMin": "Mindestanzahl für dieses Format. 0 = keine Mindestanzahl.",
    "tooltip.formatMax": "Maximale Anzahl für dieses Format. 0 = unbegrenzt.",
    "tooltip.formatsList": "Klicke ein Format zum Bearbeiten an. × löscht den Eintrag.",

    "label.formatsDefine": "Formate definieren",
    "label.formatAdd": "Neues Format hinzufügen",
    "help.formatMinMax": "Min/Max: 0 = beliebig viele",
    "ui.minMax": "Min: {min}, Max: {max}",

    "popup.ok": "OK",
    "popup.defaultInfo": "Fertig.",
    "popup.defaultError": "Es ist ein Fehler aufgetreten.",

    "msg.noActiveDocument": "Kein aktives Dokument",
    "msg.noSelection": "Keine Objekte ausgewählt",
    "msg.noBounds": "Keine Objekte mit Bounds gefunden",
    "msg.chooseDirection": "Bitte mindestens eine Richtung auswählen",
    "msg.invalidSpacing": "Bitte gültigen Abstand eingeben",
    "msg.chooseScaleTarget": "Bitte mindestens 'Rahmen' oder 'Inhalt' auswählen",
    "msg.invalidResize": "Bitte gültige Breite/Höhe eingeben (eine Seite reicht bei gelocktem Verhältnis)",
    "msg.maxDimensionExceeded": "Maximale Größe überschritten (max: {max}mm)",
    "msg.resized": "{count} Objekt(e) erfolgreich angepasst",
    "msg.distributed": "{count} Objekt(e) erfolgreich verteilt",
    "msg.distributedScaled": "{count} Objekt(e) erfolgreich verteilt und skaliert",
    "msg.templateNameRequired": "Bitte Template-Namen eingeben",
    "msg.templateSelectRequired": "Bitte Template auswählen",
    "msg.templateSaved": "Template gespeichert",
    "msg.templateDeleted": "Template gelöscht",
    "msg.centeredFrames": "{count} Rahmen zentriert",
    "msg.scaledFrames": "{count} Rahmen skaliert ({mode})",
    "msg.noFramesWithContent": "Keine Rahmen mit Inhalt gefunden",
    "msg.invalidFormat": "Bitte gültige Breite und Höhe eingeben",
    "msg.templatesSaveFailed": "Templates konnten nicht gespeichert werden: {message}",
    "msg.errorWithMessage": "Fehler: {message}",
    "ui.noTemplates": "Keine Templates gespeichert",
    "ui.noFormats": "Keine Formate definiert",
    "msg.minMaxNonNegative": "Min/Max müssen >= 0 sein",
    "msg.minNotGreaterMax": "Min darf nicht größer als Max sein",
    "msg.multiFormatError": "Multi-Format Fehler: {message}",
    "msg.noFormatsDefined": "Keine Formate definiert. Bitte mindestens ein Format hinzufügen.",
    "msg.clipboardUnavailable": "Clipboard nicht verfügbar. Log bitte manuell kopieren.",
    "msg.panelLoaded": "Panel geladen. Aktionen werden hier geloggt.",
    "msg.unknownError": "Unbekannter Fehler"
  },
  en: {
    "tabs.resize": "Resize",
    "tabs.distribute": "Distribute",
    "tabs.distributeScale": "Distribute & Scale",
    "tabs.tools": "Tools",
    "tabs.settings": "Settings",

    "title.templates": "Templates",
    "title.formatDefinition": "Format definition",
    "title.sizeConstraints": "Size constraints",
    "title.multiFormats": "Multiple formats (used in Multi mode)",
    "title.plugin": "Plugin",
    "help.distribute": "Distributes selected items evenly with equal spacing between items and margins.",
    "help.distributeScale": "Distributes and scales selected items to fill the area with the given spacing.",
    "help.tools": "Additional tools for working with frames and content.",
    "help.centerContent": "Centers content (graphics) within the selected frames.",
    "title.centerContent": "Center content",
    "title.fitToFrame": "Fit to frame",

    "settings.showLog": "Show log panel",
    "settings.showPopups": "Show popups",
    "settings.language": "Language",
    "settings.language.de": "German",
    "settings.language.en": "English",

    "btn.apply": "Apply",
    "btn.saveTemplate": "Save template",
    "btn.delete": "Delete",
    "btn.distribute": "Distribute",
    "btn.distributeScale": "Distribute & Scale",
    "btn.centerContent": "Center content",
    "btn.fitToFrame": "Fit to frame",
    "btn.copyLog": "Copy log",
    "btn.clearLog": "Clear log",
    "btn.addFormat": "Add format",
    "btn.updateFormat": "Update format",
    "btn.cancel": "Cancel",
    "btn.clearFormats": "Clear all",

    "tooltip.lockRatio": "Lock proportions: when enabled, width or height is enough.",
    "tooltip.applyResize": "Applies the target size to the selection.",
    "tooltip.applyDistribute": "Distributes the selection evenly.",
    "tooltip.applyDistributeScale": "Distributes and scales the selection within the chosen area.",
    "tooltip.centerContent": "Centers graphics inside the selected frames.",
    "tooltip.fitToFrame": "Fits content to frame (depending on mode).",
    "tooltip.copyLog": "Copies the log to the clipboard.",
    "tooltip.clearLog": "Clears the log.",

    "tooltip.formatWidth": "Format width (mm) for Multi mode.",
    "tooltip.formatHeight": "Format height (mm) for Multi mode.",
    "tooltip.formatMin": "Minimum required count for this format. 0 = no minimum.",
    "tooltip.formatMax": "Maximum allowed count for this format. 0 = unlimited.",
    "tooltip.formatsList": "Click a format to edit. × deletes the entry.",

    "label.formatsDefine": "Define formats",
    "label.formatAdd": "Add new format",
    "help.formatMinMax": "Min/Max: 0 = unlimited",
    "ui.minMax": "Min: {min}, Max: {max}",

    "popup.ok": "OK",
    "popup.defaultInfo": "Done.",
    "popup.defaultError": "An error occurred.",

    "msg.noActiveDocument": "No active document",
    "msg.noSelection": "No objects selected",
    "msg.noBounds": "No objects with bounds found",
    "msg.chooseDirection": "Please select at least one direction",
    "msg.invalidSpacing": "Please enter a valid spacing",
    "msg.chooseScaleTarget": "Please select at least 'Frame' or 'Content'",
    "msg.invalidResize": "Please enter a valid width/height (one side is enough when proportions are locked)",
    "msg.maxDimensionExceeded": "Maximum size exceeded (max: {max}mm)",
    "msg.resized": "Resized {count} object(s)",
    "msg.distributed": "Distributed {count} object(s)",
    "msg.distributedScaled": "Distributed and scaled {count} object(s)",
    "msg.templateNameRequired": "Please enter a template name",
    "msg.templateSelectRequired": "Please select a template",
    "msg.templateSaved": "Template saved",
    "msg.templateDeleted": "Template deleted",
    "msg.centeredFrames": "Centered {count} frame(s)",
    "msg.scaledFrames": "Scaled {count} frame(s) ({mode})",
    "msg.noFramesWithContent": "No frames with content found",
    "msg.invalidFormat": "Please enter a valid width and height",
    "msg.templatesSaveFailed": "Templates could not be saved: {message}",
    "msg.errorWithMessage": "Error: {message}",
    "ui.noTemplates": "No templates saved",
    "ui.noFormats": "No formats defined",
    "msg.minMaxNonNegative": "Min/Max must be >= 0",
    "msg.minNotGreaterMax": "Min must not be greater than Max",
    "msg.multiFormatError": "Multi-format error: {message}",
    "msg.noFormatsDefined": "No formats defined. Please add at least one format.",
    "msg.clipboardUnavailable": "Clipboard not available. Please copy the log manually.",
    "msg.panelLoaded": "Panel loaded. Actions will be logged here.",
    "msg.unknownError": "Unknown error"
  }
};

function syncFormatsToSettings() {
  pluginSettings.formats = Array.isArray(definedFormats) ? definedFormats : [];
  if (settingsReady) queueSaveSettings();
}

function getLanguage() {
  const lang = (pluginSettings && pluginSettings.language) || "de";
  return I18N[lang] ? lang : "de";
}

function t(key, vars = null) {
  const lang = getLanguage();
  const raw = (I18N[lang] && I18N[lang][key]) || (I18N.de && I18N.de[key]) || key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

function formatErrorMessage(err) {
  const msg = err && typeof err.message === "string" ? err.message.trim() : "";
  return msg || t("msg.unknownError");
}

function mergeSettings(base, incoming) {
  if (!incoming || typeof incoming !== "object") return { ...base };
  return {
    ...base,
    ...incoming,
    ui: {
      ...base.ui,
      ...(incoming.ui || {})
    }
  };
}

async function loadSettings() {
  try {
    const folder = await getPluginDataFolder();
    const file = await folder.getEntry(SETTINGS_FILENAME);
    const text = await file.read();
    const parsed = JSON.parse(text);
    pluginSettings = mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch (e) {
    pluginSettings = { ...DEFAULT_SETTINGS };
  }
  return pluginSettings;
}

let saveSettingsTimer = null;
function queueSaveSettings() {
  if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
  saveSettingsTimer = setTimeout(() => {
    saveSettingsTimer = null;
    void saveSettings();
  }, 250);
}

async function saveSettings() {
  try {
    const folder = await getPluginDataFolder();
    const file = await folder.createFile(SETTINGS_FILENAME, { overwrite: true });
    await file.write(JSON.stringify(pluginSettings, null, 2));
  } catch (e) {
    // settings save failures should not break UX
    console.warn("Settings konnten nicht gespeichert werden:", e);
  }
}

function applyLanguageToUI() {
  // Tabs
  const tabMap = {
    resize: "tabs.resize",
    distribute: "tabs.distribute",
    "distribute-scale": "tabs.distributeScale",
    tools: "tabs.tools",
    settings: "tabs.settings"
  };
  document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
    const key = tabMap[btn.getAttribute("data-tab")];
    if (key) btn.textContent = t(key);
  });

  // Headings / helper texts
  const setTextById = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  };
  setTextById("title-templates", "title.templates");
  setTextById("title-format-definition", "title.formatDefinition");
  setTextById("title-size-constraints", "title.sizeConstraints");
  setTextById("title-multi-formats", "title.multiFormats");
  setTextById("label-formats-define", "label.formatsDefine");
  setTextById("label-format-add", "label.formatAdd");
  setTextById("help-format-minmax", "help.formatMinMax");
  setTextById("title-plugin-settings", "title.plugin");
  setTextById("help-distribute", "help.distribute");
  setTextById("help-distribute-scale", "help.distributeScale");
  setTextById("help-tools", "help.tools");
  setTextById("title-center-content", "title.centerContent");
  setTextById("help-center-content", "help.centerContent");
  setTextById("title-fit-to-frame", "title.fitToFrame");

  // Settings controls
  const lblLog = document.querySelector('label[for="setting-log-enabled"]');
  if (lblLog) lblLog.textContent = t("settings.showLog");
  const lblPopups = document.querySelector('label[for="setting-popups-enabled"]');
  if (lblPopups) lblPopups.textContent = t("settings.showPopups");
  const lblLang = document.querySelector('label[for="setting-language"]');
  if (lblLang) lblLang.textContent = t("settings.language");
  const optDe = document.querySelector('#setting-language option[value="de"]');
  if (optDe) optDe.textContent = t("settings.language.de");
  const optEn = document.querySelector('#setting-language option[value="en"]');
  if (optEn) optEn.textContent = t("settings.language.en");

  // Buttons
  const setBtn = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  };
  setBtn("apply-resize-btn", "btn.apply");
  setBtn("save-template-btn", "btn.saveTemplate");
  setBtn("delete-template-btn", "btn.delete");
  setBtn("apply-distribute-btn", "btn.distribute");
  setBtn("apply-distribute-scale-btn", "btn.distributeScale");
  setBtn("center-content-btn", "btn.centerContent");
  setBtn("scale-to-frame-btn", "btn.fitToFrame");
  setBtn("add-format-btn", "btn.addFormat");
  setBtn("cancel-edit-format-btn", "btn.cancel");
  setBtn("clear-formats-btn", "btn.clearFormats");
  setBtn("copy-log-btn", "btn.copyLog");
  setBtn("clear-log-btn", "btn.clearLog");
}

function setFormatEditState(index) {
  editFormatIndex = typeof index === 'number' ? index : null;

  const cancelBtn = document.getElementById('cancel-edit-format-btn');
  if (cancelBtn) cancelBtn.hidden = editFormatIndex === null;

  const addBtn = document.getElementById('add-format-btn');
  if (addBtn) addBtn.textContent = t(editFormatIndex === null ? 'btn.addFormat' : 'btn.updateFormat');

  const listEl = document.getElementById('format-list');
  if (listEl) {
    listEl.querySelectorAll('.format-item').forEach((el) => el.classList.remove('selected'));
    if (editFormatIndex !== null) {
      const selected = listEl.querySelector(`.format-item[data-index="${editFormatIndex}"]`);
      if (selected) selected.classList.add('selected');
    }
  }
}

function applyTooltips() {
  const overrides = {
    "lock-proportion": "tooltip.lockRatio",
    "apply-resize-btn": "tooltip.applyResize",
    "apply-distribute-btn": "tooltip.applyDistribute",
    "apply-distribute-scale-btn": "tooltip.applyDistributeScale",
    "center-content-btn": "tooltip.centerContent",
    "scale-to-frame-btn": "tooltip.fitToFrame",
    "copy-log-btn": "tooltip.copyLog",
    "clear-log-btn": "tooltip.clearLog"
    ,
    "format-list": "tooltip.formatsList",
    "format-width": "tooltip.formatWidth",
    "format-height": "tooltip.formatHeight",
    "format-min": "tooltip.formatMin",
    "format-max": "tooltip.formatMax"
  };
  Object.keys(overrides).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute("title", t(overrides[id]));
  });

  // Generic fallbacks: label text -> title
  document.querySelectorAll("input, select, textarea, button").forEach((el) => {
    if (el.getAttribute("title")) return;
    const id = el.getAttribute("id");
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label && label.textContent.trim()) {
        el.setAttribute("title", label.textContent.trim());
        return;
      }
    }
    const placeholder = el.getAttribute("placeholder");
    if (placeholder) {
      el.setAttribute("title", placeholder);
      return;
    }
    const text = (el.textContent || "").trim();
    if (text) {
      el.setAttribute("title", text);
    }
  });
}

function applyLogVisibility() {
  const logContainer = document.getElementById("log-container");
  if (logContainer) {
    const visible = !!pluginSettings.logEnabled;
    logContainer.hidden = !visible;
    logContainer.style.display = visible ? 'block' : 'none';
  }
}

// ============================
// Entry Point Setup
// ============================
entrypoints.setup({
  panels: {
    mainPanel: {
      show() {
        // Panel wird automatisch mit index.html geladen
        safeInitPanel('entrypoints.show');
      }
    }
  }
});

// ============================
// Utility Functions
// ============================

function setFrameSizeKeepCenter(item, width, height) {
  if (!item || !item.geometricBounds) return;
  const b = item.geometricBounds; // [y1, x1, y2, x2]
  const cx = (b[1] + b[3]) / 2;
  const cy = (b[0] + b[2]) / 2;
  const newLeft = cx - width / 2;
  const newTop = cy - height / 2;
  item.geometricBounds = [
    newTop,
    newLeft,
    newTop + height,
    newLeft + width
  ];
}

function resizeItem(item, targetWidth, targetHeight, { scaleFrame = true, scaleContent = true, keepCenter = true } = {}) {
  if (!item || !item.geometricBounds) return;

  if (scaleFrame && targetWidth && targetHeight) {
    if (keepCenter) {
      setFrameSizeKeepCenter(item, targetWidth, targetHeight);
    } else {
      const b = item.geometricBounds;
      item.geometricBounds = [
        b[0],
        b[1],
        b[0] + targetHeight,
        b[1] + targetWidth
      ];
    }
  }

  if (scaleContent && targetWidth && targetHeight) {
    const frameWidth = item.geometricBounds[3] - item.geometricBounds[1];
    const frameHeight = item.geometricBounds[2] - item.geometricBounds[0];
    scaleGraphicsInObject(item, frameWidth, frameHeight);
  }
}

function scaleGraphicsInObject(obj, targetWidth, targetHeight) {
  if (!obj || !obj.allGraphics || obj.allGraphics.length === 0) return;
  if (!targetWidth || !targetHeight) return;

  for (let j = 0; j < obj.allGraphics.length; j++) {
    const graphic = obj.allGraphics[j];
    try {
      // Reset scaling to avoid compounding errors
      graphic.absoluteHorizontalScale = 100;
      graphic.absoluteVerticalScale = 100;

      // Versuche FitOptions zu verwenden
      if (obj.fit && FitOptions) {
        // Fit proportionally into the frame, then center
        obj.fit(FitOptions.FILL_PROPORTIONALLY);
        obj.fit(FitOptions.CENTER_CONTENT);
      } else if (graphic.geometricBounds) {
        // Fallback: manual uniform scale to maintain aspect ratio
        const gb = graphic.geometricBounds;
        const gw = gb[3] - gb[1];
        const gh = gb[2] - gb[0];
        if (gw > 0 && gh > 0) {
          const scale = Math.min(targetWidth / gw, targetHeight / gh) * 100;
          graphic.horizontalScale = scale;
          graphic.verticalScale = scale;

          // Zentriere die Grafik manuell im Rahmen
          const frameBounds = obj.geometricBounds;
          const frameWidth = frameBounds[3] - frameBounds[1];
          const frameHeight = frameBounds[2] - frameBounds[0];
          const frameCenterX = frameBounds[1] + frameWidth / 2;
          const frameCenterY = frameBounds[0] + frameHeight / 2;

          const newGB = graphic.geometricBounds;
          const graphicWidth = newGB[3] - newGB[1];
          const graphicHeight = newGB[2] - newGB[0];

          graphic.geometricBounds = [
            frameCenterY - graphicHeight / 2,
            frameCenterX - graphicWidth / 2,
            frameCenterY + graphicHeight / 2,
            frameCenterX + graphicWidth / 2
          ];
        }
      }
    } catch (e) {
      appendLog("Grafik konnte nicht skaliert werden: " + e.message);
    }
  }
}

/**
 * Zeigt eine Fehler-/Erfolgsmeldung mit UXP Dialog
 */
async function showMessage(message, isError = false) {
  try {
    const msg = (typeof message === "string" ? message.trim() : "") || (isError ? t("popup.defaultError") : t("popup.defaultInfo"));

    // If popups are disabled, log instead.
    if (!pluginSettings.popupsEnabled) {
      appendLog((isError ? "❌ " : "✅ ") + msg);
      return;
    }

    // Erstelle ein natives UXP Dialog Element
    const dialog = document.createElement('dialog');
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.border = isError ? '2px solid var(--uxp-color-red-600)' : '2px solid var(--uxp-color-accent)';
    dialog.style.minWidth = '300px';

    const messageText = document.createElement('p');
    messageText.textContent = msg;
    messageText.style.margin = '0 0 16px 0';
    messageText.style.color = isError ? 'var(--uxp-color-red-600)' : 'var(--uxp-color-text-primary)';

    const okButton = document.createElement('button');
    okButton.textContent = t('popup.ok');
    okButton.className = isError ? 'btn-secondary' : 'btn-primary';
    okButton.style.width = '100%';
    okButton.onclick = () => dialog.close();

    dialog.appendChild(messageText);
    dialog.appendChild(okButton);
    document.body.appendChild(dialog);

    dialog.showModal();

    // Auto-cleanup nach close
    dialog.addEventListener('close', () => {
      dialog.remove();
    });

  } catch (e) {
    // Absoluter Fallback: Console log
    console.error(isError ? "ERROR:" : "INFO:", message);
    appendLog((isError ? "❌ " : "✅ ") + message);
  }
}

// ============================
// Logging Helpers
// ============================

function getBoundsData(item) {
  if (!item || !item.geometricBounds) return null;
  const b = item.geometricBounds;
  return {
    x: b[1],
    y: b[0],
    width: b[3] - b[1],
    height: b[2] - b[0]
  };
}

function boundsToText(bounds) {
  if (!bounds) return "n/a";
  const fmt = (n) => (typeof n === "number" ? n.toFixed(2) : "n/a");
  return `x=${fmt(bounds.x)}, y=${fmt(bounds.y)}, w=${fmt(bounds.width)}, h=${fmt(bounds.height)}`;
}

function appendLog(message) {
  const ts = new Date().toLocaleTimeString();
  logBuffer.push(`[${ts}] ${message}`);
  if (logBuffer.length > LOG_LIMIT) {
    logBuffer.shift();
  }
  const logEl = document.getElementById("log-output");
  if (logEl) {
    const text = logBuffer.join("\n");
    if (logEl.tagName === "TEXTAREA") {
      logEl.value = text;
    } else {
      logEl.textContent = text;
    }
    logEl.scrollTop = logEl.scrollHeight;
  }
}

// ============================
// DOM helpers (UI)
// ============================

function getCheckedRadioValue(groupName, fallback = null) {
  if (!groupName) return fallback;
  const radios = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
  for (let i = 0; i < radios.length; i++) {
    if (radios[i] && radios[i].checked) return radios[i].value;
  }
  // fallback for environments where :checked works
  const el = document.querySelector(`input[name="${groupName}"]:checked`);
  return el ? el.value : fallback;
}

function setVisible(el, visible, shownDisplay = '') {
  if (!el) return;
  el.hidden = !visible;
  if (visible) {
    if (shownDisplay) el.style.display = shownDisplay;
    else el.style.removeProperty('display');
  } else {
    el.style.display = 'none';
  }
}

function clearLog() {
  logBuffer.length = 0;
  const logEl = document.getElementById("log-output");
  if (logEl) {
    if (logEl.tagName === "TEXTAREA") {
      logEl.value = "Log geleert.";
    } else {
      logEl.textContent = "Log geleert.";
    }
  }
}

async function copyLogToClipboard() {
  const text = logBuffer.join("\n");
  if (!text) {
    appendLog("Log ist leer – nichts zu kopieren.");
    return;
  }

  try {
    // UXP Clipboard API (Standard Methode)
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      appendLog("Log in Zwischenablage kopiert.");
      return;
    }
  } catch (err) {
    console.error("Clipboard-API fehlgeschlagen:", err);
    appendLog("Clipboard-Fehler: " + err.message);
  }

  // Fallback nicht verfügbar in InDesign
  appendLog("Clipboard API nicht verfügbar. Bitte manuell kopieren.");
  showMessage(t('msg.clipboardUnavailable'), true);
}

/**
 * Holt die aktuelle Seite
 */
function getCurrentPage() {
  if (!app || !app.activeDocument) {
    throw new Error("Kein aktives Dokument");
  }

  const doc = app.activeDocument;
  const layoutWindows = (doc && doc.layoutWindows) || [];

  // 1) Aktive Seite des ersten LayoutWindows
  if (layoutWindows.length > 0 && layoutWindows[0]) {
    const activeWindow = layoutWindows[0];
    if (activeWindow.activePage) {
      return activeWindow.activePage;
    }
    if (activeWindow.activeSpread && activeWindow.activeSpread.pages && activeWindow.activeSpread.pages.length > 0) {
      return activeWindow.activeSpread.pages[0];
    }
  }

  // 2) Fallback: Erste Seite des aktiven Spreads
  if (doc.activeSpread && doc.activeSpread.pages && doc.activeSpread.pages.length > 0) {
    return doc.activeSpread.pages[0];
  }

  // 3) Fallback: Erste Seite des Dokuments
  if (doc.pages && doc.pages.length > 0) {
    return doc.pages[0];
  }

  throw new Error("Keine Seite gefunden");
}

/**
 * Holt die Seitenränder (bounds)
 */
function getPageBounds(page) {
  const doc = app && app.activeDocument;
  if (!doc) {
    throw new Error("Kein aktives Dokument");
  }

  // Prefer echte Page-Bounds
  if (page && page.bounds && page.bounds.length === 4) {
    const bounds = page.bounds; // [y1, x1, y2, x2]
    return {
      top: bounds[0],
      left: bounds[1],
      bottom: bounds[2],
      right: bounds[3],
      width: bounds[3] - bounds[1],
      height: bounds[2] - bounds[0]
    };
  }

  // Fallback: Dokumentabmessungen (0,0 Ursprung)
  if (doc && doc.documentPreferences) {
    const dp = doc.documentPreferences;
    const width = dp.pageWidth;
    const height = dp.pageHeight;
    if (width && height) {
      return {
        top: 0,
        left: 0,
        bottom: height,
        right: width,
        width: width,
        height: height
      };
    }
  }

  throw new Error("Keine gültigen Seiten-Bounds");
}

/**
 * Berechnet die Bounding Box aller ausgewählten Objekte
 */
function getSelectionBounds(items) {
  if (!items || items.length === 0) {
    throw new Error("Keine Items für Bounding Box");
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  items.forEach(item => {
    if (item.bounds) {
      const b = item.bounds;
      minY = Math.min(minY, b[0]);
      minX = Math.min(minX, b[1]);
      maxY = Math.max(maxY, b[2]);
      maxX = Math.max(maxX, b[3]);
    }
  });

  if (minX === Infinity) {
    throw new Error("Keine gültigen Bounds gefunden");
  }

  return {
    top: minY,
    left: minX,
    bottom: maxY,
    right: maxX,
    width: maxX - minX,
    height: maxY - minY
  };
}

// ============================
// Multi-Format System
// ============================

function renderFormatList() {
  const listEl = document.getElementById('format-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  if (definedFormats.length === 0) {
    listEl.innerHTML = `<div class="helper-text">${t('ui.noFormats')}</div>`;
    return;
  }

  definedFormats.forEach((fmt, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'format-item';
    itemDiv.setAttribute('data-index', String(index));
    if (editFormatIndex === index) itemDiv.classList.add('selected');

    itemDiv.addEventListener('click', () => {
      const w = document.getElementById('format-width');
      const h = document.getElementById('format-height');
      const minEl = document.getElementById('format-min');
      const maxEl = document.getElementById('format-max');

      if (w) w.value = String(fmt.width);
      if (h) h.value = String(fmt.height);
      if (minEl) minEl.value = String(fmt.min ?? 0);
      if (maxEl) maxEl.value = String(fmt.max ?? 0);

      setFormatEditState(index);
    });

    const specsSpan = document.createElement('span');
    specsSpan.className = 'format-specs';
    specsSpan.textContent = `${fmt.width.toFixed(1)} × ${fmt.height.toFixed(1)} mm`;

    const constraintsSpan = document.createElement('span');
    constraintsSpan.className = 'format-constraints';
    const minTxt = fmt.min === 0 ? '0' : fmt.min.toString();
    const maxTxt = fmt.max === 0 ? '∞' : fmt.max.toString();
    constraintsSpan.textContent = t('ui.minMax', { min: minTxt, max: maxTxt });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'format-delete';
    deleteBtn.textContent = '×';
    deleteBtn.setAttribute('title', t('btn.delete'));
    deleteBtn.addEventListener('click', (e) => {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      // prevent triggering edit on parent click
      try { deleteBtn.blur(); } catch (_) { }
      definedFormats.splice(index, 1);
      syncFormatsToSettings();
      if (editFormatIndex === index) setFormatEditState(null);
      if (editFormatIndex !== null && editFormatIndex > index) editFormatIndex -= 1;
      renderFormatList();
      appendLog(`Format gelöscht: ${fmt.width}x${fmt.height}mm`);
    });

    itemDiv.appendChild(specsSpan);
    itemDiv.appendChild(constraintsSpan);
    itemDiv.appendChild(deleteBtn);
    listEl.appendChild(itemDiv);
  });
}

function addFormat() {
  const width = parseFloat(document.getElementById('format-width').value);
  const height = parseFloat(document.getElementById('format-height').value);
  const min = parseInt(document.getElementById('format-min').value) || 0;
  const max = parseInt(document.getElementById('format-max').value) || 0;

  if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
    showMessage(t('msg.invalidFormat'), true);
    return;
  }

  if (min < 0 || max < 0) {
    showMessage(t('msg.minMaxNonNegative'), true);
    return;
  }

  if (max > 0 && min > max) {
    showMessage(t('msg.minNotGreaterMax'), true);
    return;
  }

  if (editFormatIndex !== null && definedFormats[editFormatIndex]) {
    definedFormats[editFormatIndex] = { width, height, min, max };
    appendLog(`Format aktualisiert: ${width}x${height}mm, Min=${min}, Max=${max}`);
    setFormatEditState(null);
  } else {
    definedFormats.push({ width, height, min, max });
    appendLog(`Format hinzugefügt: ${width}x${height}mm, Min=${min}, Max=${max}`);
  }
  syncFormatsToSettings();
  renderFormatList();

  // Reset inputs
  document.getElementById('format-width').value = '';
  document.getElementById('format-height').value = '';
  document.getElementById('format-min').value = '0';
  document.getElementById('format-max').value = '0';

  // leave edit mode (already handled above)
}

function clearFormats() {
  definedFormats = [];
  syncFormatsToSettings();
  setFormatEditState(null);
  renderFormatList();
  appendLog('Alle Formate gelöscht');
}

/**
 * Findet optimale Anordnung mit definierten Formaten
 */
function findOptimalLayoutWithFormats(itemCount, formats, availableWidth, availableHeight, spacing) {
  // Validiere Constraints
  const totalMin = formats.reduce((sum, f) => sum + f.min, 0);
  if (totalMin > itemCount) {
    throw new Error(`Minimum-Anforderungen (∑min=${totalMin}) übersteigen Objekt-Anzahl (${itemCount})`);
  }

  const totalMax = formats.reduce((sum, f) => sum + (f.max === 0 ? Infinity : f.max), 0);
  if (totalMax < itemCount && isFinite(totalMax)) {
    throw new Error(`Maximum-Beschränkungen (∑max=${totalMax}) unterschreiten Objekt-Anzahl (${itemCount})`);
  }

  // Versuche verschiedene Anordnungen und wähle beste
  let bestLayout = null;
  let bestScore = Infinity;

  // Iteriere über mögliche Rasteraufteilungen
  for (let cols = 1; cols <= itemCount; cols++) {
    const rows = Math.ceil(itemCount / cols);

    // Versuche Formate zu verteilen
    const distribution = distributeFormats(itemCount, formats);
    if (!distribution) continue;

    // Berechne ob das Layout in die verfügbare Fläche passt
    const layoutScore = scoreLayout(distribution, cols, rows, availableWidth, availableHeight, spacing);

    if (layoutScore !== null && layoutScore < bestScore) {
      bestScore = layoutScore;
      bestLayout = {
        cols,
        rows,
        distribution,
        score: layoutScore
      };
    }
  }

  if (!bestLayout) {
    throw new Error('Keine gültige Anordnung mit den gegebenen Formaten möglich');
  }

  return bestLayout;
}

function distributeFormats(itemCount, formats) {
  // Einfache greedy-Strategie: Erfülle erst Minimums, dann fülle auf
  const result = [];
  let remaining = itemCount;

  // Phase 1: Erfülle alle Minimums
  formats.forEach(fmt => {
    const count = Math.min(fmt.min, remaining);
    for (let i = 0; i < count; i++) {
      result.push({ ...fmt });
    }
    remaining -= count;
  });

  // Phase 2: Fülle restliche mit Formaten die noch Platz haben
  while (remaining > 0) {
    let added = false;

    for (let fmt of formats) {
      const currentCount = result.filter(r => r.width === fmt.width && r.height === fmt.height).length;
      const canAdd = fmt.max === 0 || currentCount < fmt.max;

      if (canAdd) {
        result.push({ ...fmt });
        remaining--;
        added = true;
        break;
      }
    }

    if (!added) return null; // Keine gültige Verteilung möglich
  }

  return result;
}

function scoreLayout(distribution, cols, rows, availableWidth, availableHeight, spacing) {
  // Vereinfachtes Scoring: Berechne ob Layout passt
  // Gruppiere nach Format und berechne durchschnittliche Größe
  const avgWidth = distribution.reduce((sum, f) => sum + f.width, 0) / distribution.length;
  const avgHeight = distribution.reduce((sum, f) => sum + f.height, 0) / distribution.length;

  const totalWidth = avgWidth * cols + spacing * (cols + 1);
  const totalHeight = avgHeight * rows + spacing * (rows + 1);

  if (totalWidth > availableWidth || totalHeight > availableHeight) {
    return null; // Passt nicht
  }

  // Score: Je besser die Fläche genutzt wird, desto besser
  const usedArea = totalWidth * totalHeight;
  const availableArea = availableWidth * availableHeight;
  const usage = usedArea / availableArea;

  return 1 - usage; // Kleinerer Score = besser (mehr Fläche genutzt)
}

// ============================
// Template Management
// ============================

async function loadTemplates() {
  try {
    const folder = await getPluginDataFolder();
    const entries = await folder.getEntries();

    // Suche nach templates.json
    let templateFile = null;
    for (const entry of entries) {
      if (entry.name === STORAGE_FILENAME && entry.isFile) {
        templateFile = entry;
        break;
      }
    }

    if (!templateFile) {
      return [];
    }

    const contents = await templateFile.read();
    const parsed = JSON.parse(contents);

    // Validiere Array
    if (!Array.isArray(parsed)) {
      console.warn('Ungültige Template-Daten, setze zurück');
      return [];
    }

    // Validiere einzelne Templates
    return parsed.filter(t =>
      t &&
      typeof t.name === 'string' &&
      typeof t.width === 'number' &&
      typeof t.height === 'number' &&
      t.width > 0 &&
      t.height > 0
    );
  } catch (e) {
    console.error('Fehler beim Laden der Templates:', e);
    appendLog('Templates konnten nicht geladen werden: ' + e.message);
    return [];
  }
}

async function saveTemplates(templates) {
  try {
    if (!Array.isArray(templates)) {
      throw new Error('Templates muss ein Array sein');
    }

    const folder = await getPluginDataFolder();
    const templateFile = await folder.createFile(STORAGE_FILENAME, { overwrite: true });
    await templateFile.write(JSON.stringify(templates, null, 2));

    appendLog(`${templates.length} Template(s) gespeichert`);
  } catch (e) {
    console.error("Fehler beim Speichern der Templates:", e);
    appendLog('Fehler beim Speichern: ' + e.message);
    showMessage(t('msg.templatesSaveFailed', { message: formatErrorMessage(e) }), true);
  }
}

async function renderTemplates() {
  const templates = await loadTemplates();
  const listEl = document.getElementById("template-list");

  if (!listEl) return;

  // Leere Liste zuerst
  listEl.innerHTML = '';

  if (templates.length === 0) {
    listEl.innerHTML = `<div class="helper-text">${t('ui.noTemplates')}</div>`;
    return;
  }

  // Erstelle Template-Items sicher mit DOM-API statt innerHTML
  templates.forEach((t, index) => {
    // Validiere Template-Daten
    if (!t || typeof t.name !== 'string' || typeof t.width !== 'number' || typeof t.height !== 'number') {
      console.warn('Ungültiges Template übersprungen:', t);
      return;
    }

    const itemDiv = document.createElement('div');
    itemDiv.className = 'template-item';
    itemDiv.setAttribute('data-index', index.toString());

    const nameSpan = document.createElement('span');
    nameSpan.className = 'template-name';
    nameSpan.textContent = t.name; // Sicher gegen XSS

    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'template-size';
    sizeSpan.textContent = `${t.width.toFixed(1)}mm × ${t.height.toFixed(1)}mm`;

    itemDiv.appendChild(nameSpan);
    itemDiv.appendChild(sizeSpan);

    // Event Listener
    itemDiv.addEventListener('click', () => {
      // Deselect all
      listEl.querySelectorAll('.template-item').forEach(i => i.classList.remove('selected'));
      // Select clicked
      itemDiv.classList.add('selected');

      const widthInput = document.getElementById('resize-width');
      const heightInput = document.getElementById('resize-height');
      if (widthInput) widthInput.value = t.width.toString();
      if (heightInput) heightInput.value = t.height.toString();
    });

    listEl.appendChild(itemDiv);
  });
}

// ============================
// Feature 1: Größenzuweisung
// ============================

async function applyResize() {
  try {
    if (!app || !app.activeDocument) {
      showMessage(t('msg.noActiveDocument'), true);
      return;
    }

    const doc = app.activeDocument;

    const selection = doc.selection;
    if (!selection || selection.length === 0) {
      showMessage(t('msg.noSelection'), true);
      return;
    }

    let width = parseFloat(document.getElementById('resize-width').value);
    let height = parseFloat(document.getElementById('resize-height').value);
    const lockRatio = document.getElementById('lock-proportion').classList.contains('active');

    // Berechne Seitenverhältnis aus erstem Objekt falls nötig
    const first = selection[0];
    let ratio = null;
    if (first && first.geometricBounds) {
      const b = first.geometricBounds;
      const cw = b[3] - b[1];
      const ch = b[2] - b[0];
      if (cw > 0 && ch > 0) {
        ratio = ch / cw;
      }
    }

    // Proportionaler Modus erlaubt Angabe nur einer Kante
    if (lockRatio && ratio) {
      if (!isNaN(width) && (isNaN(height) || height <= 0)) {
        height = width * ratio;
      } else if (!isNaN(height) && (isNaN(width) || width <= 0)) {
        width = height / ratio;
      }
    }

    if (isNaN(width) || isNaN(height) || width < MIN_DIMENSION || height < MIN_DIMENSION) {
      showMessage(t('msg.invalidResize'), true);
      return;
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      showMessage(t('msg.maxDimensionExceeded', { max: MAX_DIMENSION }), true);
      return;
    }

    const scaleFrame = document.getElementById('resize-frame').checked;
    const scaleContent = document.getElementById('resize-content').checked;

    if (!scaleFrame && !scaleContent) {
      showMessage(t('msg.chooseScaleTarget'), true);
      return;
    }

    appendLog(`Resize gestartet: ${selection.length} Objekt(e), Ziel w=${width}, h=${height}, Frame=${scaleFrame}, Inhalt=${scaleContent}`);

    // Verarbeite jedes ausgewählte Objekt
    for (let i = 0; i < selection.length; i++) {
      const item = selection[i];

      // Prüfe ob das Objekt geometrische Bounds hat
      if (!item.geometricBounds) continue;

      const before = getBoundsData(item);

      resizeItem(item, width, height, {
        scaleFrame,
        scaleContent,
        keepCenter: true
      });

      const after = getBoundsData(item);
      const label = item && typeof item.id !== "undefined" ? `ID ${item.id}` : `Index ${i}`;
      appendLog(`Resize -> ${label}: Start ${boundsToText(before)} | Ziel w=${width.toFixed(2)}, h=${height.toFixed(2)} | Result ${boundsToText(after)}`);
    }

    showMessage(t('msg.resized', { count: selection.length }));

  } catch (error) {
    showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(error) }), true);
    console.error(error);
  }
}

// ============================
// Feature 2: Verteilen ohne Skalierung
// ============================

async function applyDistribute() {
  try {
    if (!app || !app.activeDocument) {
      showMessage(t('msg.noActiveDocument'), true);
      return;
    }

    const doc = app.activeDocument;

    const selection = doc.selection;
    if (!selection || selection.length === 0) {
      showMessage(t('msg.noSelection'), true);
      return;
    }

    const horizontal = document.getElementById('distribute-horizontal').checked;
    const vertical = document.getElementById('distribute-vertical').checked;

    if (!horizontal && !vertical) {
      showMessage(t('msg.chooseDirection'), true);
      return;
    }

    const gapInput = document.getElementById('distribute-gap');
    const gap = gapInput ? parseFloat(gapInput.value) || 5 : 5;

    const method = getCheckedRadioValue('distribution-method', 'auto');
    const areaMode = getCheckedRadioValue('distribution-area', 'page');

    // Sammle Objekt-Informationen
    const items = [];
    for (let i = 0; i < selection.length; i++) {
      const item = selection[i];
      if (item.geometricBounds) {
        const bounds = item.geometricBounds;
        items.push({
          object: item,
          width: bounds[3] - bounds[1],
          height: bounds[2] - bounds[0],
          bounds: bounds
        });
      }
    }

    if (items.length === 0) {
      showMessage(t('msg.noBounds'), true);
      return;
    }

    // Bestimme Verteilungsbereich
    let distributionBounds;
    if (areaMode === 'selection') {
      distributionBounds = getSelectionBounds(items);
      appendLog(`Verteilen in Auswahl-Bounds: ${boundsToText(distributionBounds)}`);
    } else {
      const page = getCurrentPage();
      distributionBounds = getPageBounds(page);
      appendLog(`Verteilen auf Seite: ${boundsToText(distributionBounds)}`);
    }

    appendLog(`Verteilen gestartet: ${items.length} Objekt(e), horizontal=${horizontal}, vertical=${vertical}, Methode=${method}, Bereich=${areaMode}, Gap=${gap}mm`);

    if (method === 'grid') {
      const cols = parseInt(document.getElementById('grid-cols').value) || 3;
      const rows = parseInt(document.getElementById('grid-rows').value) || 3;
      distributeGrid(items, distributionBounds, cols, rows, horizontal, vertical, gap);
    } else {
      distributeAuto(items, distributionBounds, horizontal, vertical, gap);
    }

    showMessage(t('msg.distributed', { count: items.length }));

  } catch (error) {
    showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(error) }), true);
    console.error(error);
  }
}

function distributeAuto(items, pageBounds, horizontal, vertical, gap = 5) {
  // Berechne optimale Anordnung (quadratisches Raster)
  const count = items.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  distributeGrid(items, pageBounds, cols, rows, horizontal, vertical, gap);
}

function distributeGrid(items, pageBounds, cols, rows, horizontal, vertical, gap = 5) {

  // Fallbacks
  cols = Math.max(1, cols || 1);
  rows = Math.max(1, rows || 1);

  // Berechne durchschnittliche Objektgröße
  const avgWidth = items.reduce((sum, item) => sum + item.width, 0) / items.length;
  const avgHeight = items.reduce((sum, item) => sum + item.height, 0) / items.length;

  // Berechne verfügbaren Raum
  const availableWidth = pageBounds.width;
  const availableHeight = pageBounds.height;

  // Berechne Abstände unter Berücksichtigung des Gaps
  const totalItemsWidth = avgWidth * cols;
  const totalItemsHeight = avgHeight * rows;

  // Spacing ist mindestens Gap, kann aber größer sein wenn Platz übrig ist
  const minSpacingX = gap;
  const minSpacingY = gap;

  const remainingWidth = availableWidth - totalItemsWidth - (minSpacingX * (cols + 1));
  const remainingHeight = availableHeight - totalItemsHeight - (minSpacingY * (rows + 1));

  // Verteile überschüssigen Raum gleichmäßig
  const spacingX = horizontal ? minSpacingX + (remainingWidth > 0 ? remainingWidth / (cols + 1) : 0) : 0;
  const spacingY = vertical ? minSpacingY + (remainingHeight > 0 ? remainingHeight / (rows + 1) : 0) : 0;

  // Das Grid startet am Rand der Seite plus ersten Spacing
  // Kein zusätzlicher Offset nötig - Spacing ist bereits berechnet

  // Verteile Objekte
  let index = 0;
  for (let row = 0; row < rows && index < items.length; row++) {
    for (let col = 0; col < cols && index < items.length; col++) {
      const item = items[index];
      const obj = item.object;
      const currentBounds = item.bounds;
      const before = getBoundsData(obj);
      const label = obj && typeof obj.id !== "undefined" ? `ID ${obj.id}` : `Index ${index}`;

      let newLeft = currentBounds[1];
      let newTop = currentBounds[0];

      if (horizontal) {
        newLeft = pageBounds.left + spacingX * (col + 1) + avgWidth * col;
      }

      if (vertical) {
        newTop = pageBounds.top + spacingY * (row + 1) + avgHeight * row;
      }

      // Setze neue Position direkt via geometricBounds
      // (move() funktioniert in InDesign UXP nicht zuverlässig)
      obj.geometricBounds = [
        newTop,
        newLeft,
        newTop + item.height,
        newLeft + item.width
      ];

      const after = getBoundsData(obj);
      appendLog(`Verteilen -> ${label}: Start ${boundsToText(before)} | Ziel x=${newLeft.toFixed(2)}, y=${newTop.toFixed(2)} | Result ${boundsToText(after)}`);

      index++;
    }
  }
}

// ============================
// Feature 3: Verteilen mit Skalierung
// ============================

async function applyDistributeScale() {
  const areaMode = getCheckedRadioValue('scale-distribution-area', 'page');
  const formatMode = getCheckedRadioValue('format-mode', 'single');
  try {
    if (!app || !app.activeDocument) {
      showMessage(t('msg.noActiveDocument'), true);
      return;
    }

    const doc = app.activeDocument;

    const selection = doc.selection;
    if (!selection || selection.length === 0) {
      showMessage(t('msg.noSelection'), true);
      return;
    }

    const spacing = parseFloat(document.getElementById('spacing').value);
    const minWidth = parseFloat(document.getElementById('scale-min-width').value);
    const maxWidth = parseFloat(document.getElementById('scale-max-width').value);
    const minHeight = parseFloat(document.getElementById('scale-min-height').value);
    const maxHeight = parseFloat(document.getElementById('scale-max-height').value);

    if (isNaN(spacing) || spacing < 0) {
      showMessage(t('msg.invalidSpacing'), true);
      return;
    }

    const scaleFrame = document.getElementById('scale-frame').checked;
    const scaleContent = document.getElementById('scale-content').checked;

    if (!scaleFrame && !scaleContent) {
      showMessage(t('msg.chooseScaleTarget'), true);
      return;
    }

    const areaMode = getCheckedRadioValue('scale-distribution-area', 'page');

    // Sammle Objekte
    const items = [];
    for (let i = 0; i < selection.length; i++) {
      const item = selection[i];
      if (item.geometricBounds) {
        const bounds = item.geometricBounds;
        items.push({
          object: item,
          width: bounds[3] - bounds[1],
          height: bounds[2] - bounds[0],
          bounds: bounds
        });
      }
    }

    if (items.length === 0) {
      showMessage(t('msg.noBounds'), true);
      return;
    }

    // Bestimme Verteilungsbereich
    let distributionBounds;
    if (areaMode === 'selection') {
      distributionBounds = getSelectionBounds(items);
      appendLog(`Verteilen & Skalieren in Auswahl-Bounds: ${boundsToText(distributionBounds)}`);
    } else {
      const page = getCurrentPage();
      distributionBounds = getPageBounds(page);
      appendLog(`Verteilen & Skalieren auf Seite: ${boundsToText(distributionBounds)}`);
    }

    appendLog(`Verteilen & Skalieren gestartet: ${items.length} Objekt(e), spacing=${spacing}, Frame=${scaleFrame}, Inhalt=${scaleContent}, Bereich=${areaMode}`);

    // Prüfe Format-Modus
    const formatMode = getCheckedRadioValue('format-mode', 'single');

    if (formatMode === 'multi' && (!definedFormats || definedFormats.length === 0)) {
      showMessage(t('msg.noFormatsDefined'), true);
      return;
    }

    let cols, rows, formatAssignments;

    if (formatMode === 'multi' && definedFormats.length > 0) {
      // Multi-Format Modus
      appendLog(`Multi-Format Modus: ${definedFormats.length} Format(e) definiert`);

      try {
        const layout = findOptimalLayoutWithFormats(
          items.length,
          definedFormats,
          distributionBounds.width,
          distributionBounds.height,
          spacing
        );

        cols = layout.cols;
        rows = layout.rows;
        formatAssignments = layout.distribution;

        appendLog(`Optimales Layout: ${cols}x${rows}, Score=${layout.score.toFixed(3)}`);
      } catch (err) {
        const msg = t('msg.multiFormatError', { message: formatErrorMessage(err) });
        showMessage(msg, true);
        appendLog(msg);
        return;
      }
    } else {
      // Single Format Modus (bisherige Logik)
      const count = items.length;
      cols = Math.ceil(Math.sqrt(count));
      rows = Math.ceil(count / cols);
      formatAssignments = null;
    }

    // Berechne verfügbaren Raum (abzüglich Abstände)
    const availableWidth = distributionBounds.width - spacing * (cols + 1);
    const availableHeight = distributionBounds.height - spacing * (rows + 1);

    // Berechne Objekt-Größe (single mode) oder nutze Assignments (multi mode)
    let defaultItemWidth = availableWidth / cols;
    let defaultItemHeight = availableHeight / rows;

    // Wende Min/Max Constraints an (nur im Single-Modus)
    if (formatMode === 'single') {
      const minWidth = parseFloat(document.getElementById('scale-min-width').value);
      const maxWidth = parseFloat(document.getElementById('scale-max-width').value);
      const minHeight = parseFloat(document.getElementById('scale-min-height').value);
      const maxHeight = parseFloat(document.getElementById('scale-max-height').value);

      if (!isNaN(minWidth) && defaultItemWidth < minWidth) defaultItemWidth = minWidth;
      if (!isNaN(maxWidth) && defaultItemWidth > maxWidth) defaultItemWidth = maxWidth;
      if (!isNaN(minHeight) && defaultItemHeight < minHeight) defaultItemHeight = minHeight;
      if (!isNaN(maxHeight) && defaultItemHeight > maxHeight) defaultItemHeight = maxHeight;
    }

    // Verteile und skaliere Objekte (Frame + optional Inhalt)
    let index = 0;
    for (let row = 0; row < rows && index < items.length; row++) {
      for (let col = 0; col < cols && index < items.length; col++) {
        const item = items[index];
        const obj = item.object;
        const currentBounds = item.bounds;
        const before = getBoundsData(obj);
        const label = obj && typeof obj.id !== "undefined" ? `ID ${obj.id}` : `Index ${index}`;

        // Bestimme Größe für dieses Objekt
        let itemWidth, itemHeight;
        if (formatAssignments && formatAssignments[index]) {
          itemWidth = formatAssignments[index].width;
          itemHeight = formatAssignments[index].height;
          appendLog(`  -> Format: ${itemWidth}x${itemHeight}mm`);
        } else {
          itemWidth = defaultItemWidth;
          itemHeight = defaultItemHeight;
        }

        // Berechne neue Position
        const newLeft = distributionBounds.left + spacing + col * (defaultItemWidth + spacing);
        const newTop = distributionBounds.top + spacing + row * (defaultItemHeight + spacing);

        // Skalieren (Frame/Content) mit derselben Logik wie Größenzuweisung
        resizeItem(obj, itemWidth, itemHeight, {
          scaleFrame,
          scaleContent,
          keepCenter: false // Nicht zentrieren, da wir Position setzen
        });

        // Danach an Zielposition schieben MIT Content
        const b2 = obj.geometricBounds;
        const offsetX = newLeft - b2[1];
        const offsetY = newTop - b2[0];

        // Setze Position direkt (move() ist in InDesign UXP nicht zuverlässig)
        obj.geometricBounds = [
          b2[0] + offsetY,
          b2[1] + offsetX,
          b2[2] + offsetY,
          b2[3] + offsetX
        ];

        const after = getBoundsData(obj);
        appendLog(`Verteilen & Skalieren -> ${label}: Start ${boundsToText(before)} | Ziel w=${itemWidth.toFixed(2)}, h=${itemHeight.toFixed(2)}, pos x=${newLeft.toFixed(2)}, y=${newTop.toFixed(2)} | Result ${boundsToText(after)}`);

        index++;
      }
    }

    showMessage(t('msg.distributedScaled', { count: items.length }));

  } catch (error) {
    showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(error) }), true);
    console.error(error);
  }
}

// ============================
// Event Listeners / Panel Init
// ============================

function initPanel() {
  // Catch runtime errors and surface them into the log when possible.
  try {
    if (!window.__ppErrorHooksInstalled) {
      window.__ppErrorHooksInstalled = true;
      window.addEventListener('error', (ev) => {
        try { appendLog(`JS Error: ${ev && ev.message ? ev.message : String(ev)}`); } catch (_) { }
      });
      window.addEventListener('unhandledrejection', (ev) => {
        try {
          const reason = ev && ev.reason;
          const msg = reason && reason.message ? reason.message : String(reason);
          appendLog(`Promise Rejection: ${msg}`);
        } catch (_) { }
      });
    }
  } catch (_) {
    // ignore
  }

  // Visual build stamp (helps detect caching even if log stays empty)
  const buildStamp = document.getElementById('ui-build-stamp');
  if (buildStamp) buildStamp.textContent = `build ${BUILD_ID}`;

  // Clean up any accidental "NaN" strings in number inputs (UXP can persist odd states)
  const sanitizeNumberInput = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = String(el.value ?? '').trim();
    if (!v) return;
    if (v.toLowerCase() === 'nan') el.value = '';
  };
  [
    'scale-min-width', 'scale-max-width', 'scale-min-height', 'scale-max-height',
    'resize-width', 'resize-height',
    'spacing',
    'format-width', 'format-height', 'format-min', 'format-max',
    'grid-cols', 'grid-rows'
  ].forEach(sanitizeNumberInput);

  // Ensure log isn't stuck on the HTML placeholder
  const logEl = document.getElementById('log-output');
  if (logEl && logEl.tagName === 'TEXTAREA' && logBuffer.length === 0) {
    logEl.value = '';
  }

  const gridSettingsEl = document.getElementById('grid-settings');
  const singleFormatEl = document.getElementById('single-format-settings');
  const multiFormatEl = document.getElementById('multi-format-settings');

  const updateGridSettingsUI = () => {
    if (!gridSettingsEl) return;
    const method = getCheckedRadioValue('distribution-method', 'auto');
    setVisible(gridSettingsEl, method === 'grid', 'flex');
    appendLog(`UI: grid-settings visible=${method === 'grid'}`);
  };

  const updateFormatModeUI = () => {
    const mode = getCheckedRadioValue('format-mode', 'single');
    setVisible(singleFormatEl, mode === 'single', 'block');
    setVisible(multiFormatEl, mode === 'multi', 'block');
    appendLog(`UI: format-settings mode=${mode}`);
  };

  // Tab Navigation
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');

      // Update tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update content
      tabContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
      });
      const targetEl = document.getElementById(`tab-${targetTab}`);
      if (targetEl) {
        targetEl.classList.add('active');
        targetEl.style.display = 'block';
      } else {
        appendLog(`Tab nicht gefunden: ${targetTab}`);
      }
    });
  });

  // Distribution method change
  const distMethodRadios = document.querySelectorAll('input[name="distribution-method"]');
  distMethodRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateGridSettingsUI();
      appendLog(e.target.value === 'grid' ? 'Raster-Modus aktiviert' : 'Automatik-Modus aktiviert');
    });
  });

  // Radio Button Fix für UXP: Explizite Label-Click Handler + immediate UI updates
  const setupRadioGroup = (groupName, afterSelect = null) => {
    const radios = document.querySelectorAll(`input[name="${groupName}"]`);
    radios.forEach(radio => {
      const selectRadio = () => {
        radios.forEach(r => r.checked = false);
        radio.checked = true;
        if (typeof afterSelect === 'function') {
          try { afterSelect(radio); } catch (_) { }
        }
        if (groupName === 'distribution-method' || groupName === 'format-mode') {
          appendLog(`UI: ${groupName} = ${radio.value}`);
        }
        // Trigger change event
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      };

      // Click auf Input selbst
      radio.addEventListener('click', () => {
        selectRadio();
      });

      // Click auf Label
      const label = document.querySelector(`label[for="${radio.id}"]`);
      if (label) {
        label.addEventListener('click', (e) => {
          e.preventDefault();
          selectRadio();
        });
      }

      // Click anywhere on the row (UXP users often click the whole line)
      const row = radio.closest('.radio-item');
      if (row) {
        row.addEventListener('click', (e) => {
          // Avoid double-select when the click originated from input/label
          if (e && (e.target === radio || e.target === label)) return;
          e.preventDefault();
          selectRadio();
        });
      }
    });
  };

  // Setup alle Radio Button Gruppen
  setupRadioGroup('distribution-method', updateGridSettingsUI);
  setupRadioGroup('distribution-area');
  setupRadioGroup('scale-distribution-area');
  setupRadioGroup('scale-mode');
  setupRadioGroup('format-mode', updateFormatModeUI);

  // Format Mode Toggle
  const formatModeRadios = document.querySelectorAll('input[name="format-mode"]');
  formatModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateFormatModeUI();
      appendLog(`Format-Modus: ${e.target.value}`);
    });
  });

  // Initial UI state
  updateGridSettingsUI();
  updateFormatModeUI();

  // Multi-Format Buttons
  const addFormatBtn = document.getElementById('add-format-btn');
  if (addFormatBtn) {
    addFormatBtn.addEventListener('click', addFormat);
  }

  const cancelEditFormatBtn = document.getElementById('cancel-edit-format-btn');
  if (cancelEditFormatBtn) {
    cancelEditFormatBtn.addEventListener('click', () => {
      setFormatEditState(null);
      const w = document.getElementById('format-width');
      const h = document.getElementById('format-height');
      const minEl = document.getElementById('format-min');
      const maxEl = document.getElementById('format-max');
      if (w) w.value = '';
      if (h) h.value = '';
      if (minEl) minEl.value = '0';
      if (maxEl) maxEl.value = '0';
    });
  }

  const clearFormatsBtn = document.getElementById('clear-formats-btn');
  if (clearFormatsBtn) {
    clearFormatsBtn.addEventListener('click', clearFormats);
  }

  // Initialize format list
  if (Array.isArray(pluginSettings.formats)) {
    definedFormats = pluginSettings.formats;
  }
  setFormatEditState(null);
  renderFormatList();

  // Settings panel
  const toggleLog = document.getElementById('setting-log-enabled');
  const togglePopups = document.getElementById('setting-popups-enabled');
  const selectLanguage = document.getElementById('setting-language');

  const setLogEnabled = (enabled) => {
    const next = !!enabled;
    pluginSettings.logEnabled = next;
    if (toggleLog) toggleLog.checked = next;
    // Log before applying visibility so "false" is visible once.
    appendLog(`UI: logEnabled=${next}`);
    applyLogVisibility();
    const lc = document.getElementById('log-container');
    if (lc) appendLog(`UI: logEnabled state (hidden=${lc.hidden}, display=${lc.style.display || 'default'})`);
    if (settingsReady) queueSaveSettings();
  };

  const setPopupsEnabled = (enabled) => {
    pluginSettings.popupsEnabled = !!enabled;
    if (togglePopups) togglePopups.checked = !!enabled;
    appendLog(`UI: popupsEnabled=${!!enabled}`);
    if (settingsReady) queueSaveSettings();
  };

  // Checkbox Fix für UXP: Row/Label toggles call setters directly
  const bindCheckbox = (id, setter) => {
    const input = document.getElementById(id);
    if (!input) return;
    const label = document.querySelector(`label[for="${id}"]`);
    const row = input.closest('.checkbox-item');
    let suppressChange = false;

    const setCheckedDeferred = (next) => {
      suppressChange = true;
      const apply = () => {
        input.checked = !!next;
        // Ensure our setter always runs even if UXP doesn't dispatch change.
        input.dispatchEvent(new Event('change', { bubbles: true }));
        try { queueMicrotask(() => { suppressChange = false; }); }
        catch (_) { setTimeout(() => { suppressChange = false; }, 0); }
      };
      try { requestAnimationFrame(apply); }
      catch (_) { setTimeout(apply, 0); }
    };

    // Native input interaction: let UXP toggle the checkmark.
    input.addEventListener('change', () => {
      // If this change was initiated by our deferred setter, allow it once.
      setter(input.checked);
      if (suppressChange) return;
    });

    // Row/label clicks: some UXP builds don't toggle via label reliably.
    const onRowOrLabelClick = (e) => {
      if (e && e.target === input) return; // native handles it
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const next = !input.checked;
      setCheckedDeferred(next);
    };

    if (label) label.addEventListener('click', onRowOrLabelClick);
    if (row) row.addEventListener('click', onRowOrLabelClick);
  };

  const inputFont = document.getElementById('setting-font');
  const inputGap = document.getElementById('setting-gap');
  const inputPad = document.getElementById('setting-pad');
  const inputDivider = document.getElementById('setting-divider');

  const applySettings = () => {
    const font = parseFloat(inputFont.value) || 11;
    const gap = parseFloat(inputGap.value) || 8;
    const pad = parseFloat(inputPad.value) || 12;
    const divider = parseFloat(inputDivider.value) || 16;

    pluginSettings.ui = {
      font,
      gap,
      pad,
      divider
    };

    const root = document.documentElement.style;
    root.setProperty('--ui-font-size', `${font}px`);
    root.setProperty('--ui-gap', `${gap}px`);
    root.setProperty('--ui-padding', `${pad}px`);
    root.setProperty('--ui-divider-margin', `${divider}px`);

    if (settingsReady) queueSaveSettings();
  };
  [inputFont, inputGap, inputPad, inputDivider].forEach(inp => {
    if (inp) {
      inp.addEventListener('input', applySettings);
    }
  });
  applySettings();

  bindCheckbox('setting-log-enabled', setLogEnabled);

  bindCheckbox('setting-popups-enabled', setPopupsEnabled);

  if (selectLanguage) {
    selectLanguage.addEventListener('change', () => {
      pluginSettings.language = selectLanguage.value;
      applyLanguageToUI();
      applyTooltips();
      if (settingsReady) queueSaveSettings();
    });
  }

  // Proportion lock button
  const lockBtn = document.getElementById('lock-proportion');
  lockBtn.addEventListener('click', () => {
    lockBtn.classList.toggle('active');
    lockBtn.textContent = lockBtn.classList.contains('active') ? '⛓' : '🔗';
  });

  // Template Management
  renderTemplates();

  document.getElementById('save-template-btn').addEventListener('click', async () => {
    const name = document.getElementById('template-name').value.trim();
    const width = parseFloat(document.getElementById('resize-width').value);
    const height = parseFloat(document.getElementById('resize-height').value);

    if (!name) {
      showMessage(t('msg.templateNameRequired'), true);
      return;
    }

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      showMessage(t('msg.invalidFormat'), true);
      return;
    }

    const templates = await loadTemplates();
    templates.push({ name, width, height });
    await saveTemplates(templates);
    await renderTemplates();

    document.getElementById('template-name').value = '';
    showMessage(t('msg.templateSaved'));
  });

  document.getElementById('delete-template-btn').addEventListener('click', async () => {
    const selected = document.querySelector('.template-item.selected');
    if (!selected) {
      showMessage(t('msg.templateSelectRequired'), true);
      return;
    }

    const index = parseInt(selected.getAttribute('data-index'));
    const templates = await loadTemplates();
    templates.splice(index, 1);
    await saveTemplates(templates);
    await renderTemplates();

    showMessage(t('msg.templateDeleted'));
  });

  // Feature Buttons
  const applyResizeBtn = document.getElementById('apply-resize-btn');
  const applyDistributeBtn = document.getElementById('apply-distribute-btn');
  const applyDistributeScaleBtn = document.getElementById('apply-distribute-scale-btn');

  if (applyResizeBtn) applyResizeBtn.addEventListener('click', applyResize);
  if (applyDistributeBtn) applyDistributeBtn.addEventListener('click', applyDistribute);
  if (applyDistributeScaleBtn) applyDistributeScaleBtn.addEventListener('click', applyDistributeScale);

  const copyLogBtn = document.getElementById('copy-log-btn');
  if (copyLogBtn) {
    copyLogBtn.addEventListener('click', copyLogToClipboard);
  }

  const clearLogBtn = document.getElementById('clear-log-btn');
  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', clearLog);
  }

  // Tools Tab Buttons
  const centerContentBtn = document.getElementById('center-content-btn');
  if (centerContentBtn) {
    centerContentBtn.addEventListener('click', async () => {
      try {
        if (!app || !app.activeDocument) {
          showMessage(t('msg.noActiveDocument'), true);
          return;
        }
        const doc = app.activeDocument;
        if (!doc || !doc.selection || doc.selection.length === 0) {
          showMessage(t('msg.noSelection'), true);
          return;
        }

        let processed = 0;
        let skipped = 0;

        for (let i = 0; i < doc.selection.length; i++) {
          const frame = doc.selection[i];

          // Prüfe ob das Objekt eine fit-Methode hat (Rahmen mit Inhalt)
          if (frame && frame.fit && FitOptions) {
            try {
              frame.fit(FitOptions.CENTER_CONTENT);
              processed++;
              const label = frame.id ? `ID ${frame.id}` : `Index ${i}`;
              appendLog(`Center Content -> ${label}: Content zentriert`);
            } catch (fitErr) {
              appendLog(`Fehler beim Zentrieren von Objekt ${i}: ${fitErr.message}`);
              skipped++;
            }
          } else {
            skipped++;
          }
        }

        appendLog(`Center Content: ${processed} Rahmen zentriert, ${skipped} übersprungen`);

        if (processed === 0) {
          showMessage(t('msg.noFramesWithContent'), true);
        } else {
          showMessage(t('msg.centeredFrames', { count: processed }));
        }
      } catch (e) {
        showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(e) }), true);
        appendLog("Center Content Fehler: " + e.message);
      }
    });
  }

  const scaleToFrameBtn = document.getElementById('scale-to-frame-btn');
  if (scaleToFrameBtn) {
    scaleToFrameBtn.addEventListener('click', async () => {
      try {
        if (!app || !app.activeDocument) {
          showMessage(t('msg.noActiveDocument'), true);
          return;
        }
        const doc = app.activeDocument;
        if (!doc || !doc.selection || doc.selection.length === 0) {
          showMessage(t('msg.noSelection'), true);
          return;
        }

        const mode = getCheckedRadioValue('scale-mode', 'fit-vert');

        let processed = 0;
        for (let i = 0; i < doc.selection.length; i++) {
          const frame = doc.selection[i];
          if (frame && frame.allGraphics && frame.allGraphics.length > 0 && frame.geometricBounds) {
            const frameBounds = frame.geometricBounds;
            const frameWidth = frameBounds[3] - frameBounds[1];
            const frameHeight = frameBounds[2] - frameBounds[0];

            for (let g = 0; g < frame.allGraphics.length; g++) {
              const graphic = frame.allGraphics[g];
              if (!graphic || !graphic.geometricBounds) continue;

              try {
                // Reset scaling
                graphic.absoluteHorizontalScale = 100;
                graphic.absoluteVerticalScale = 100;

                const gb = graphic.geometricBounds;
                const gw = gb[3] - gb[1];
                const gh = gb[2] - gb[0];

                if (gw <= 0 || gh <= 0 || frameWidth <= 0 || frameHeight <= 0) continue;

                let scaleX = 100;
                let scaleY = 100;

                if (mode === 'stretch') {
                  // Echtes Strecken: Setze Breite UND Höhe unabhängig (verzerrt)
                  scaleX = (frameWidth / gw) * 100;
                  scaleY = (frameHeight / gh) * 100;
                  appendLog(`  -> Stretch (verzerrt): scaleX=${scaleX.toFixed(1)}%, scaleY=${scaleY.toFixed(1)}%`);
                } else if (mode === 'fill') {
                  // Ausfüllen: Wähle pro Objekt ob horizontal oder vertikal angepasst wird
                  // Ziel: Rahmen wird gefüllt, Content >= Rahmen in beiden Dimensionen
                  const scaleToFitWidth = (frameWidth / gw) * 100;
                  const scaleToFitHeight = (frameHeight / gh) * 100;

                  // Wähle die Richtung wo mehr Skalierung nötig ist (= größerer Faktor)
                  // Damit wird der Content mindestens so groß wie der Rahmen in beiden Dimensionen
                  if (scaleToFitWidth > scaleToFitHeight) {
                    // Horizontal braucht mehr Skalierung -> nutze horizontal
                    const s = scaleToFitWidth;
                    scaleX = s;
                    scaleY = s;
                    const label = frame.id ? `ID ${frame.id}` : `Index ${i}`;
                    appendLog(`  -> Fill (horz) ${label}: Frame ${frameWidth.toFixed(1)}x${frameHeight.toFixed(1)}mm, Content ${gw.toFixed(1)}x${gh.toFixed(1)}mm, ScaleW=${scaleToFitWidth.toFixed(1)}% > ScaleH=${scaleToFitHeight.toFixed(1)}%, Gewählt=${s.toFixed(1)}%`);
                  } else {
                    // Vertikal braucht mehr Skalierung -> nutze vertikal
                    const s = scaleToFitHeight;
                    scaleX = s;
                    scaleY = s;
                    const label = frame.id ? `ID ${frame.id}` : `Index ${i}`;
                    appendLog(`  -> Fill (vert) ${label}: Frame ${frameWidth.toFixed(1)}x${frameHeight.toFixed(1)}mm, Content ${gw.toFixed(1)}x${gh.toFixed(1)}mm, ScaleW=${scaleToFitWidth.toFixed(1)}% < ScaleH=${scaleToFitHeight.toFixed(1)}%, Gewählt=${s.toFixed(1)}%`);
                  }
                } else if (mode === 'fit-vert') {
                  const s = (frameHeight / gh) * 100;
                  scaleX = s;
                  scaleY = s;
                } else if (mode === 'fit-horz') {
                  const s = (frameWidth / gw) * 100;
                  scaleX = s;
                  scaleY = s;
                }

                // Verwende absoluteHorizontalScale/absoluteVerticalScale für unabhängige Skalierung
                graphic.absoluteHorizontalScale = scaleX;
                graphic.absoluteVerticalScale = scaleY;

                // Zentriere die Grafik nach dem Skalieren
                if (frame.fit && FitOptions) {
                  frame.fit(FitOptions.CENTER_CONTENT);
                } else {
                  // Manuelle Zentrierung
                  const newGB = graphic.geometricBounds;
                  const graphicWidth = newGB[3] - newGB[1];
                  const graphicHeight = newGB[2] - newGB[0];
                  const frameCenterX = frameBounds[1] + frameWidth / 2;
                  const frameCenterY = frameBounds[0] + frameHeight / 2;

                  graphic.geometricBounds = [
                    frameCenterY - graphicHeight / 2,
                    frameCenterX - graphicWidth / 2,
                    frameCenterY + graphicHeight / 2,
                    frameCenterX + graphicWidth / 2
                  ];
                }
              } catch (err) {
                appendLog(`Grafik konnte nicht skaliert werden: ${err.message}`);
              }
            }
            processed++;
          }
        }

        appendLog(`Scale to Frame (${mode}): ${processed} Rahmen verarbeitet`);
        showMessage(t('msg.scaledFrames', { count: processed, mode }));
      } catch (e) {
        showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(e) }), true);
        appendLog("Scale to Frame Fehler: " + e.message);
      }
    });
  }

  // Async init: load saved settings, apply language/tooltips, sync UI controls
  void (async () => {
    await loadSettings();

    // Load persisted multi-format definitions
    if (Array.isArray(pluginSettings.formats)) {
      definedFormats = pluginSettings.formats;
    } else {
      definedFormats = [];
    }

    if (toggleLog) toggleLog.checked = !!pluginSettings.logEnabled;
    if (togglePopups) togglePopups.checked = !!pluginSettings.popupsEnabled;
    if (selectLanguage) selectLanguage.value = getLanguage();

    if (pluginSettings.ui) {
      if (inputFont) inputFont.value = String(pluginSettings.ui.font ?? 11);
      if (inputGap) inputGap.value = String(pluginSettings.ui.gap ?? 8);
      if (inputPad) inputPad.value = String(pluginSettings.ui.pad ?? 12);
      if (inputDivider) inputDivider.value = String(pluginSettings.ui.divider ?? 16);
      applySettings();
    }

    applyLanguageToUI();
    applyTooltips();
    applyLogVisibility();

    // Ensure format list reflects loaded settings
    renderFormatList();

    settingsReady = true;
  })();

  appendLog(`${t('msg.panelLoaded')} (build ${BUILD_ID})`);
}

document.addEventListener("DOMContentLoaded", () => {
  safeInitPanel('DOMContentLoaded');
});