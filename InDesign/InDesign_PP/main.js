const { entrypoints } = require("uxp");
// NOTE: In UXP some module exports can behave like dynamic getters.
// Avoid destructuring `app` at require-time; resolve it on demand.
const { FitOptions, ColorModel, ColorSpace } = require("indesign");
const fs = require("uxp").storage.localFileSystem;
const { createToolsFeature } = require("./src/features/tools");
const { createLayoutFeature } = require("./src/features/layout");
const { createPresetsFeature } = require("./src/features/presets");
const { createTemplatesFeature } = require("./src/features/templates");
const { createCalendarFeature } = require("./src/features/calendar");

// Bump this when debugging UI caching/reload issues
const BUILD_GIT_SHA = "f32c9fa";
// In UXP, DOMContentLoaded can be unreliable depending on panel lifecycle.
// We initialize from both DOMContentLoaded and entrypoints.show(), guarded to run once.
let panelInitialized = false;

function getInDesignApp() {
  try {
    const mod = require('indesign');
    return mod && mod.app ? mod.app : null;
  } catch (_) {
    return null;
  }
}

function getActiveDocumentSafe() {
  const app = getInDesignApp();
  if (!app) return null;
  try {
    if (app.activeDocument) return app.activeDocument;
  } catch (_) {
    // ignore
  }
  try {
    if (app.documents && app.documents.length > 0) return app.documents[0];
  } catch (_) {
    // ignore
  }
  return null;
}

// Font loading for calendar
function loadAvailableFonts() {
  try {
    const app = getInDesignApp();
    if (!app) return getDefaultFonts();

    let fontList = [];
    // ============================
    // Feature 1: Größenzuweisung
    // ============================

    const layoutFeature = createLayoutFeature({
      getActiveDocumentSafe,
      appendLog,
      showMessage,
      t,
      formatErrorMessage,
      parseLocalizedFloat,
      roundToMax3Decimals,
      getCheckedRadioValue,
      MIN_DIMENSION,
      MAX_DIMENSION,
      getSelectionBounds,
      getPageBounds,
      getCurrentPage,
      boundsToText,
      getBoundsData,
      resizeItem,
      distributeFormats,
      findOptimalLayoutWithFormats,
      seededShuffle,
      getPluginSettings: () => pluginSettings,
      getDefinedFormats: () => definedFormats,
      state: null
    });

    const { applyResize, applyDistribute, applyDistributeScale } = layoutFeature;

    const templatesFeature = createTemplatesFeature({
      "lock-proportion": "tooltip.lockRatio",
      "apply-resize-btn": "tooltip.applyResize",
      "apply-distribute-btn": "tooltip.applyDistribute",
      "apply-distribute-scale-btn": "tooltip.applyDistributeScale",
      "center-content-btn": "tooltip.centerContent",
      "scale-to-frame-btn": "tooltip.fitToFrame",
      "flatten-frames-btn": "tooltip.flattenFrames",
      "copy-log-btn": "tooltip.copyLog",
      "clear-log-btn": "tooltip.clearLog"
      ,
      "format-list": "tooltip.formatsList",
      "format-width": "tooltip.formatWidth",
      "format-height": "tooltip.formatHeight",
      "format-min": "tooltip.formatMin",
      "format-max": "tooltip.formatMax",
      "preview-resize": "tooltip.livePreview",
      "preview-distribute": "tooltip.livePreview",
      "preview-distribute-scale": "tooltip.livePreview",
      "preview-fit-to-frame": "tooltip.livePreview",
      "preview-center-content": "tooltip.livePreview"
      ,
      "overlap-elements": "tooltip.overlapElements"
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
        },
        hide() {
          // Reset initialization flag when panel is hidden/unloaded
          isPanelInitialized = false;

          // Cleanup: clear selection interval
          if (window.__ppSelectionInterval) {
            clearInterval(window.__ppSelectionInterval);
            window.__ppSelectionInterval = null;
          }

          // Cleanup: revert any live previews
          try {
            if (typeof revertAllLivePreviews === 'function') {
              revertAllLivePreviews();
            }
          } catch (_) {
            // ignore
          }
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

      // Live preview runs should not spam dialogs.
      if (typeof window !== 'undefined' && window.__ppSuppressPopups) {
        return;
      }

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
    const fmt = (n) => {
      if (typeof n !== "number") return "n/a";
      const rounded = roundToMax3Decimals(n);
      // Zeige bis zu 3 Nachkommastellen, aber keine unnötigen Nullen
      return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
    };
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
      let prevScrollTop = 0;
      try {
        prevScrollTop = logEl.scrollTop;
      } catch (_) {
        // ignore
      }

      const text = logBuffer.join("\n");
      logEl.textContent = text;

      try {
        if (logAutoScrollEnabled) logEl.scrollTop = logEl.scrollHeight;
        else logEl.scrollTop = prevScrollTop;
      } catch (_) {
        // ignore
      }
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
      logEl.textContent = "Log geleert.";
    }
    logAutoScrollEnabled = true;
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
  function getCurrentPage(docArg = null) {
    const doc = docArg || getActiveDocumentSafe();
    if (!doc) {
      throw new Error("Kein aktives Dokument");
    }
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
  function getPageBounds(page, docArg = null) {
    const doc = docArg || getActiveDocumentSafe();
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

        // Original-Input-String setzen, falls vorhanden, sonst wie bisher
        if (w) w.value = typeof fmt.widthStr === 'string' ? fmt.widthStr : ((typeof fmt.width === 'string') ? fmt.width : (fmt.width ?? '').toString());
        if (h) h.value = typeof fmt.heightStr === 'string' ? fmt.heightStr : ((typeof fmt.height === 'string') ? fmt.height : (fmt.height ?? '').toString());
        if (minEl) minEl.value = String(fmt.min ?? 0);
        if (maxEl) maxEl.value = String(fmt.max ?? 0);

        setFormatEditState(index);
      });

      const specsSpan = document.createElement('span');
      specsSpan.className = 'format-specs';
      specsSpan.textContent = `${roundToMax3Decimals(fmt.width)} × ${roundToMax3Decimals(fmt.height)} mm`;

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
        try { requestLivePreview('distributeScale'); } catch (_) { }
      });

      itemDiv.appendChild(specsSpan);
      itemDiv.appendChild(constraintsSpan);
      itemDiv.appendChild(deleteBtn);
      listEl.appendChild(itemDiv);
    });
  }

  function addFormat() {
    const widthInput = document.getElementById('format-width');
    const heightInput = document.getElementById('format-height');
    const widthStr = widthInput.value;
    const heightStr = heightInput.value;
    let width = parseLocalizedFloat(widthStr);
    let height = parseLocalizedFloat(heightStr);
    width = roundToMax3Decimals(width);
    height = roundToMax3Decimals(height);
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
      definedFormats[editFormatIndex] = { width, height, min, max, widthStr, heightStr };
      appendLog(`Format aktualisiert: ${width}x${height}mm, Min=${min}, Max=${max}`);
      setFormatEditState(null);
    } else {
      definedFormats.push({ width, height, min, max, widthStr, heightStr });
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

    // Note: Individual format size check removed - scoreLayout will validate if the entire grid fits

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
    // Use worst-case cell size to avoid overlaps with variable formats
    const maxWidth = Math.max(...distribution.map(f => Number(f.width) || 0), 0);
    const maxHeight = Math.max(...distribution.map(f => Number(f.height) || 0), 0);

    const totalWidth = maxWidth * cols + spacing * (cols + 1);
    const totalHeight = maxHeight * rows + spacing * (rows + 1);

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
  // Feature 1: Größenzuweisung
  // ============================

  async function applyResize() {
    try {
      const doc = getActiveDocumentSafe();
      if (!doc) {
        showMessage(t('msg.noActiveDocument'), true);
        return;
      }

      const selection = doc.selection;
      if (!selection || selection.length === 0) {
        showMessage(t('msg.noSelection'), true);
        return;
      }

      let width = parseLocalizedFloat(document.getElementById('resize-width').value);
      let height = parseLocalizedFloat(document.getElementById('resize-height').value);
      width = roundToMax3Decimals(width);
      height = roundToMax3Decimals(height);
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
        appendLog(`Resize -> ${label}: Start ${boundsToText(before)} | Ziel w=${roundToMax3Decimals(width)}, h=${roundToMax3Decimals(height)} | Result ${boundsToText(after)}`);
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
      const doc = getActiveDocumentSafe();
      if (!doc) {
        showMessage(t('msg.noActiveDocument'), true);
        return;
      }

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
      let gap = gapInput ? roundToMax3Decimals(parseLocalizedFloat(gapInput.value) || 5) : 5;

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
        const page = getCurrentPage(doc);
        distributionBounds = getPageBounds(page, doc);
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
        appendLog(`Verteilen -> ${label}: Start ${boundsToText(before)} | Ziel x=${roundToMax3Decimals(newLeft)}, y=${roundToMax3Decimals(newTop)} | Result ${boundsToText(after)}`);

        index++;
      }
    }
  }

  // ============================
  // Feature 3: Verteilen mit Skalierung
  // ============================

  async function applyDistributeScale() {
    try {
      const areaMode = getCheckedRadioValue('scale-distribution-area', 'page');
      const formatMode = getCheckedRadioValue('format-mode', 'single');

      const doc = getActiveDocumentSafe();
      if (!doc) {
        showMessage(t('msg.noActiveDocument'), true);
        return;
      }

      const selection = doc.selection;
      if (!selection || selection.length === 0) {
        showMessage(t('msg.noSelection'), true);
        return;
      }

      const overlapEl = document.getElementById('overlap-elements');
      const overlapEnabled = overlapEl ? !!overlapEl.checked : !!pluginSettings.overlapElements;
      let spacing = overlapEnabled ? 0 : parseLocalizedFloat(document.getElementById('spacing').value);
      spacing = roundToMax3Decimals(spacing);

      if (isNaN(spacing) || spacing < 0) {
        showMessage(t('msg.invalidSpacing'), true);
        return;
      }

      const scaleFrame = document.getElementById('scale-frame').checked;
      const scaleContent = document.getElementById('scale-content').checked;

      const keepAspectEl = document.getElementById('scale-keep-aspect');
      const keepAspect = keepAspectEl ? !!keepAspectEl.checked : !!pluginSettings.scaleKeepAspect;

      if (!scaleFrame && !scaleContent) {
        showMessage(t('msg.chooseScaleTarget'), true);
        return;
      }

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
        // Check if we can create empty frames from formats
        const allowEmptyFramesEl = document.getElementById('allow-empty-frames');
        const hasFormats = definedFormats && definedFormats.length > 0;

        if (!allowEmptyFramesEl || !allowEmptyFramesEl.checked || !hasFormats) {
          showMessage(t('msg.noBounds'), true);
          return;
        }

        appendLog(`📭 Keine Objekte ausgewählt - erstelle ${definedFormats.reduce((sum, f) => sum + (f.min || 0), 0)} leere Rahmen aus Preset`);
      }

      // Bestimme Verteilungsbereich
      let distributionBounds;
      if (areaMode === 'selection') {
        distributionBounds = getSelectionBounds(items);
        appendLog(`Verteilen & Skalieren in Auswahl-Bounds: ${boundsToText(distributionBounds)}`);
      } else {
        const page = getCurrentPage(doc);
        distributionBounds = getPageBounds(page, doc);
        appendLog(`Verteilen & Skalieren auf Seite: ${boundsToText(distributionBounds)}`);
      }

      appendLog(`Verteilen & Skalieren gestartet: ${items.length} Objekt(e), spacing=${spacing}, Frame=${scaleFrame}, Inhalt=${scaleContent}, Bereich=${areaMode}`);

      // Prüfe Format-Modus (bereits am Anfang der Funktion deklariert)

      const layoutStyleEl = document.getElementById('multi-layout-style');
      const multiLayoutStyle = layoutStyleEl ? layoutStyleEl.value : (pluginSettings.multiLayoutStyle || 'grid');

      const allowEmptyFramesEl = document.getElementById('allow-empty-frames');
      let allowEmptyFrames = allowEmptyFramesEl ? !!allowEmptyFramesEl.checked : !!pluginSettings.allowEmptyFrames;

      // Masonry: optional manual target frame count
      const masonryCountModeEl = document.getElementById('masonry-count-mode');
      const masonryTargetCountEl = document.getElementById('masonry-target-count');
      const masonryCountMode = masonryCountModeEl ? String(masonryCountModeEl.value || 'selection') : String(pluginSettings.masonryCountMode || 'selection');
      const masonryTargetCount = (() => {
        const raw = masonryTargetCountEl ? parseInt(String(masonryTargetCountEl.value || ''), 10) : parseInt(String(pluginSettings.masonryTargetCount || ''), 10);
        return Number.isFinite(raw) && raw > 0 ? raw : 0;
      })();

      if (formatMode === 'multi' && (!definedFormats || definedFormats.length === 0)) {
        showMessage(t('msg.noFormatsDefined'), true);
        return;
      }

      if (formatMode === 'multi' && !scaleFrame) {
        const msg = 'Multi-Format benötigt "Rahmen" aktiviert (sonst können die Formatgrößen nicht angewendet werden).';
        showMessage(msg, true);
        appendLog(`❌ ${msg}`);
        return;
      }
      if (state) state.warnedNeedsFrame = false;

      let cols, rows, formatAssignments;
      let formatsForLayout = null;

      const originalItemCount = items.length;
      let targetCount = originalItemCount;

      if (formatMode === 'multi' && definedFormats.length > 0) {
        // Multi-Format Modus
        appendLog(`Multi-Format Modus: ${definedFormats.length} Format(e) definiert`);

        // Calculate minimum space requirement based on Min values
        const totalMinRequired = definedFormats.reduce((sum, f) => sum + (parseInt(f.min, 10) || 0), 0);
        if (totalMinRequired > 0) {
          const minWidths = definedFormats.filter(f => (parseInt(f.min, 10) || 0) > 0).map(f => Number(f.width) || 0);
          const minHeights = definedFormats.filter(f => (parseInt(f.min, 10) || 0) > 0).map(f => Number(f.height) || 0);
          const avgMinWidth = minWidths.length > 0 ? (minWidths.reduce((a, b) => a + b, 0) / minWidths.length) : 0;
          const totalMinHeight = minHeights.reduce((a, b) => a + b, 0);

          const estimatedMinWidth = avgMinWidth > 0 ? avgMinWidth + spacing : 0;
          const estimatedMinHeight = totalMinHeight + spacing * (totalMinRequired + 1);

          if (estimatedMinHeight > distributionBounds.height) {
            const msg = `Multi-Format: Mindest-Platzbedarfwarnung: ${totalMinRequired} Rahmen (\u2211Min) ben\u00f6tigen gesch\u00e4tzt ${estimatedMinHeight.toFixed(0)}mm H\u00f6he, aber nur ${distributionBounds.height.toFixed(0)}mm verf\u00fcgbar. Reduziere Min-Werte oder aktiviere "Formate an Seite anpassen".`;
            appendLog(`\u26a0\ufe0f ${msg}`);
            showMessage(msg, true);
          }
        }

        // Option: scale formats down to fit the area (solves oversized formats like 400x400 on A4)
        const scaleToFitEl = document.getElementById('scale-formats-to-fit');
        const scaleFormatsToFit = scaleToFitEl ? !!scaleToFitEl.checked : !!pluginSettings.scaleFormatsToFit;

        formatsForLayout = definedFormats;
        if (scaleFormatsToFit) {
          const maxW = Math.max(...definedFormats.map(f => Number(f.width) || 0), 0);
          const maxH = Math.max(...definedFormats.map(f => Number(f.height) || 0), 0);
          const fitW = (distributionBounds.width - spacing * 2);
          const fitH = (distributionBounds.height - spacing * 2);
          const s = Math.min(
            maxW > 0 ? (fitW / maxW) : 1,
            maxH > 0 ? (fitH / maxH) : 1,
            1
          );

          if (s > 0 && s < 1) {
            formatsForLayout = definedFormats.map(f => ({
              ...f,
              width: (Number(f.width) || 0) * s,
              height: (Number(f.height) || 0) * s
            }));
            appendLog(`Multi-Format: Formate skaliert (factor=${s.toFixed(3)}) um in den Bereich zu passen`);
          }
        }

        // If user chose a manual masonry frame count, we will create extra empty frames.
        if (multiLayoutStyle === 'masonry' && masonryCountMode === 'manual' && masonryTargetCount > originalItemCount) {
          if (!allowEmptyFrames) {
            allowEmptyFrames = true;
            appendLog(`Masonry: Manuelle Rahmenanzahl (${masonryTargetCount}) aktiviert -> "Leere Rahmen erlauben" wird für diesen Lauf erzwungen`);
          }
        }

        const totalMin = definedFormats.reduce((sum, f) => sum + (parseInt(f.min, 10) || 0), 0);
        if (totalMin > originalItemCount && !allowEmptyFrames) {
          const msg = `Multi-Format: ∑Min=${totalMin} ist größer als Auswahl (${originalItemCount}). Aktiviere "Leere Rahmen erlauben" oder reduziere Min.`;
          showMessage(msg, true);
          appendLog(`❌ ${msg}`);
          return;
        }

        if (allowEmptyFrames) {
          targetCount = Math.max(originalItemCount, totalMin);
          if (targetCount > originalItemCount) {
            appendLog(`Leere Rahmen erlaubt: Zielanzahl Frames=${targetCount} (Auswahl=${originalItemCount}, ∑Min=${totalMin})`);
          }
        }

        if (multiLayoutStyle === 'masonry' && masonryCountMode === 'manual' && masonryTargetCount > 0) {
          const before = targetCount;
          targetCount = Math.max(targetCount, originalItemCount, masonryTargetCount);
          if (targetCount !== before) {
            appendLog(`Masonry: Zielanzahl Frames (manuell) = ${targetCount}`);
          }
        }

        try {
          if (multiLayoutStyle === 'masonry') {
            // Masonry does not require a strict grid fit; just generate an assignment list.
            const distribution = distributeFormats(targetCount, formatsForLayout);
            if (!distribution) {
              throw new Error('Keine gültige Verteilung möglich (prüfe Max-Werte: ∑max muss ≥ Auswahl sein oder setze Max=0 für unbegrenzt).');
            }
            cols = 1;
            rows = distribution.length;
            formatAssignments = distribution;
            appendLog(`Masonry: Assignments erzeugt (${distribution.length}) (Grid-Optimierung übersprungen)`);
          } else {
            const layout = findOptimalLayoutWithFormats(
              targetCount,
              formatsForLayout,
              distributionBounds.width,
              distributionBounds.height,
              spacing
            );

            cols = layout.cols;
            rows = layout.rows;
            formatAssignments = layout.distribution;

            appendLog(`Optimales Layout: ${cols}x${rows}, Score=${layout.score.toFixed(3)}`);
          }
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
        let minWidthSingle = roundToMax3Decimals(parseLocalizedFloat(document.getElementById('scale-min-width').value));
        let maxWidthSingle = roundToMax3Decimals(parseLocalizedFloat(document.getElementById('scale-max-width').value));
        let minHeightSingle = roundToMax3Decimals(parseLocalizedFloat(document.getElementById('scale-min-height').value));
        let maxHeightSingle = roundToMax3Decimals(parseLocalizedFloat(document.getElementById('scale-max-height').value));

        if (!isNaN(minWidthSingle) && defaultItemWidth < minWidthSingle) defaultItemWidth = minWidthSingle;
        if (!isNaN(maxWidthSingle) && defaultItemWidth > maxWidthSingle) defaultItemWidth = maxWidthSingle;
        if (!isNaN(minHeightSingle) && defaultItemHeight < minHeightSingle) defaultItemHeight = minHeightSingle;
        if (!isNaN(maxHeightSingle) && defaultItemHeight > maxHeightSingle) defaultItemHeight = maxHeightSingle;
      }

      // Verteile und skaliere Objekte (Frame + optional Inhalt)
      let slotCount = formatAssignments ? formatAssignments.length : items.length;
      let createdEmpty = 0;

      const createEmptyFrame = () => {
        const page = getCurrentPage(doc);
        try {
          if (page && page.rectangles && typeof page.rectangles.add === 'function') {
            const rect = page.rectangles.add();
            try {
              if (typeof window !== 'undefined' && window.__ppLivePreviewContext && window.__ppLivePreviewContext.isPreview) {
                const list = window.__ppLivePreviewContext.createdObjects;
                if (Array.isArray(list)) list.push(rect);
              }
            } catch (_) { }
            return rect;
          }
        } catch (_) {
          // ignore
        }
        try {
          if (doc && doc.rectangles && typeof doc.rectangles.add === 'function') {
            const rect = doc.rectangles.add();
            try {
              if (typeof window !== 'undefined' && window.__ppLivePreviewContext && window.__ppLivePreviewContext.isPreview) {
                const list = window.__ppLivePreviewContext.createdObjects;
                if (Array.isArray(list)) list.push(rect);
              }
            } catch (_) { }
            return rect;
          }
        } catch (_) {
          // ignore
        }
        throw new Error('Leere Rahmen konnten nicht erstellt werden (rectangles.add nicht verfügbar).');
      };

      // In multi-format mode we place items either in a grid or using a masonry column algorithm.
      let cellW = defaultItemWidth;
      let cellH = defaultItemHeight;
      if (formatMode === 'multi') {
        const wFromAssignments = formatAssignments && formatAssignments.length > 0
          ? Math.max(...formatAssignments.map(f => f.width || 0), 0)
          : 0;
        const hFromAssignments = formatAssignments && formatAssignments.length > 0
          ? Math.max(...formatAssignments.map(f => f.height || 0), 0)
          : 0;
        const wFromFormats = formatsForLayout && formatsForLayout.length > 0
          ? Math.max(...formatsForLayout.map(f => f.width || 0), 0)
          : 0;
        const hFromFormats = formatsForLayout && formatsForLayout.length > 0
          ? Math.max(...formatsForLayout.map(f => f.height || 0), 0)
          : 0;

        const maxW = Math.max(wFromAssignments, wFromFormats, 0);
        const maxH = Math.max(hFromAssignments, hFromFormats, 0);

        // IMPORTANT:
        // In masonry mode, defaultItemWidth is based on cols=1 (full-page width), which would force maxColsByWidth=1.
        // We want the column width to be driven by the max format size instead.
        if (multiLayoutStyle === 'masonry') {
          cellW = maxW > 0 ? maxW : cellW;
          cellH = maxH > 0 ? maxH : cellH;
        } else {
          cellW = Math.max(cellW, maxW);
          cellH = Math.max(cellH, maxH);
        }
      }

      const boundsBottom = distributionBounds.top + distributionBounds.height;
      const boundsRight = distributionBounds.left + distributionBounds.width;

      const fmtKey = (f) => `${Number(f.width || 0).toFixed(4)}x${Number(f.height || 0).toFixed(4)}`;

      // Masonry settings (DOM wins over persisted settings)
      const masonryPresetEl = document.getElementById('masonry-preset');
      const masonryColsEl = document.getElementById('masonry-cols');
      const masonrySeedEl = document.getElementById('masonry-seed');
      const masonryFillEl = document.getElementById('masonry-fill-page');
      const masonryPreset = masonryPresetEl ? String(masonryPresetEl.value || 'custom') : String(pluginSettings.masonryPreset || 'custom');
      const masonrySeed = (masonrySeedEl ? masonrySeedEl.value : (pluginSettings.masonrySeed || '')).trim();
      const masonryFillPage = masonryFillEl ? !!masonryFillEl.checked : !!pluginSettings.masonryFillPage;
      const autoColsByCount = (count) => {
        const n = Math.max(1, Number(count) || 1);
        if (n <= 3) return 1;
        if (n <= 8) return 2;
        if (n <= 15) return 3;
        if (n <= 24) return 4;
        return 5;
      };

      const masonryColsRequested = (() => {
        if (masonryPreset === 'auto') return autoColsByCount(slotCount);
        if (/^cols-\d+$/.test(masonryPreset)) {
          const n = parseInt(masonryPreset.replace('cols-', ''), 10);
          return Number.isFinite(n) && n > 0 ? n : 3;
        }
        const raw = masonryColsEl ? parseInt(String(masonryColsEl.value || ''), 10) : parseInt(String(pluginSettings.masonryCols || ''), 10);
        return Number.isFinite(raw) && raw > 0 ? raw : 3;
      })();

      let index = 0;
      if (formatMode === 'multi' && multiLayoutStyle === 'masonry') {
        if (formatAssignments && masonrySeed) {
          formatAssignments = seededShuffle([...formatAssignments], masonrySeed);
        }

        const uniformColWidthEl = document.getElementById('masonry-uniform-col-width');
        const uniformColWidth = uniformColWidthEl ? !!uniformColWidthEl.checked : !!pluginSettings.masonryUniformColWidth;

        const multiKeepAspectEl = document.getElementById('multi-keep-aspect');
        const multiKeepAspect = multiKeepAspectEl ? !!multiKeepAspectEl.checked : (pluginSettings.multiKeepAspect !== false);

        // Compute column width for positioning.
        // - uniformColWidth: columns fill the available width evenly, items are scaled to fit column width.
        // - otherwise: column width is based on max format width (cellW), items keep their format sizes.
        let masonryCols = Math.max(1, masonryColsRequested);
        let colInnerW = cellW;

        // In multi-format mode, check if we should adjust column count based on format sizes
        const maxFormatWidth = formatsForLayout && formatsForLayout.length > 0
          ? Math.max(...formatsForLayout.map(f => Number(f.width) || 0), 0)
          : cellW;

        // For non-uniform columns, use average format width for better space utilization
        const avgFormatWidth = formatsForLayout && formatsForLayout.length > 0
          ? (formatsForLayout.reduce((sum, f) => sum + (Number(f.width) || 0), 0) / formatsForLayout.length)
          : cellW;

        if (uniformColWidth) {
          // Reduce cols if the computed width would become too small.
          while (masonryCols > 1) {
            const w = (distributionBounds.width - spacing * (masonryCols + 1)) / masonryCols;
            if (Number.isFinite(w) && w >= MIN_DIMENSION) break;
            masonryCols -= 1;
          }
          colInnerW = (distributionBounds.width - spacing * (masonryCols + 1)) / masonryCols;
          if (!Number.isFinite(colInnerW) || colInnerW < MIN_DIMENSION) {
            const msg = `Masonry: Spaltenbreite ungültig (cols=${masonryCols}, spacing=${spacing}).`;
            appendLog(`❌ ${msg}`);
            showMessage(msg, true);
            return;
          }
        } else {
          // Non-uniform: Start with requested columns but allow dynamic expansion
          // Columns are created on-demand as items are placed
          // Initial estimate based on widest format, but not a hard limit
          const colW0 = maxFormatWidth + spacing;
          const estimatedMaxCols = Math.max(1, Math.floor((distributionBounds.width + spacing) / colW0));
          // Don't hard-limit columns - we'll check space dynamically when placing
          masonryCols = masonryColsRequested; // Start with user request
          // colInnerW is not used in non-uniform mode (dynamic per column)
          colInnerW = maxFormatWidth; // for reference only

          appendLog(`Masonry (non-uniform): Start mit ${masonryCols} Spalten (geschätzt max ${estimatedMaxCols} bei max Format-Breite ${maxFormatWidth.toFixed(2)}mm), dynamische Erweiterung aktiv`);
        }

        // For uniform mode: fixed column width and positions
        // For non-uniform mode: dynamic tracking of each column's width and x-position
        const colW = uniformColWidth ? (colInnerW + spacing) : 0; // only used in uniform mode
        const heights = new Array(masonryCols).fill(0);
        const colWidths = new Array(masonryCols).fill(0); // track actual max width per column (non-uniform)

        appendLog(`Masonry: cols=${masonryCols}/${masonryColsRequested}, colW=${uniformColWidth ? colInnerW.toFixed(2) + 'mm (uniform)' : 'dynamisch (non-uniform)'}, seed="${masonrySeed}", fillPage=${masonryFillPage}, allowEmptyFrames=${allowEmptyFrames}`);

        const pickBestCol = () => {
          let bestCol = 0;
          for (let c = 1; c < heights.length; c++) {
            if (heights[c] < heights[bestCol]) bestCol = c;
          }
          return bestCol;
        };

        // Helper: Calculate total width used by columns (for non-uniform mode)
        const getTotalUsedWidth = () => {
          if (uniformColWidth) return masonryCols * colW;
          let total = spacing; // left margin
          for (let i = 0; i < masonryCols; i++) {
            total += colWidths[i] + spacing;
          }
          return total;
        };

        // Helper: Try to add a new column for non-uniform mode
        const tryAddColumn = (itemWidth) => {
          if (uniformColWidth) return false; // only for non-uniform
          const currentWidth = getTotalUsedWidth();
          const neededWidth = currentWidth + itemWidth + spacing;
          if (neededWidth <= distributionBounds.width) {
            heights.push(0);
            colWidths.push(0);
            masonryCols++;
            return true;
          }
          return false;
        };

        const placeMasonry = (w, h) => {
          let bestCol = pickBestCol();
          let cellLeft, cellTop;

          if (uniformColWidth) {
            // Fixed column positions
            cellLeft = distributionBounds.left + spacing + bestCol * colW;
            cellTop = distributionBounds.top + spacing + heights[bestCol];

            // Center item within column if it's narrower than column width
            const horizontalOffset = w < colInnerW ? (colInnerW - w) / 2 : 0;
            const newLeft = cellLeft + horizontalOffset;
            const newTop = cellTop;
            const newRight = newLeft + w;
            const newBottom = newTop + h;

            // keep a bottom margin = spacing
            if (newBottom > boundsBottom - spacing) return null;
            if (newRight > boundsRight - spacing) return null;

            heights[bestCol] += (h + spacing);
            return { newLeft, newTop };
          } else {
            // Dynamic column positions based on actual placed items
            cellTop = distributionBounds.top + spacing + heights[bestCol];

            // Calculate X position: sum of all previous columns' widths plus spacing
            cellLeft = distributionBounds.left + spacing;
            for (let i = 0; i < bestCol; i++) {
              cellLeft += colWidths[i] + spacing;
            }

            const newLeft = cellLeft;
            const newTop = cellTop;
            const newRight = newLeft + w;
            const newBottom = newTop + h;

            // Check vertical bound
            if (newBottom > boundsBottom - spacing) {
              // Item doesn't fit vertically in bestCol
              // Try to add a new column if there's horizontal space
              if (tryAddColumn(w)) {
                bestCol = masonryCols - 1; // use the new column
                cellTop = distributionBounds.top + spacing;

                // Recalculate X for new column
                cellLeft = distributionBounds.left + spacing;
                for (let i = 0; i < bestCol; i++) {
                  cellLeft += colWidths[i] + spacing;
                }

                const newLeft2 = cellLeft;
                const newTop2 = cellTop;
                const newRight2 = newLeft2 + w;
                const newBottom2 = newTop2 + h;

                if (newRight2 > boundsRight - spacing || newBottom2 > boundsBottom - spacing) {
                  return null; // Still doesn't fit
                }

                heights[bestCol] = h + spacing;
                colWidths[bestCol] = w;
                return { newLeft: newLeft2, newTop: newTop2 };
              }
              return null;
            }

            // Check horizontal bound
            if (newRight > boundsRight - spacing) return null;

            // Update column height
            heights[bestCol] += (h + spacing);

            // Update column width to the maximum item width in this column
            if (w > colWidths[bestCol]) {
              colWidths[bestCol] = w;
            }

            return { newLeft, newTop };
          }
        };

        const counts = new Map();
        if (formatAssignments) {
          for (const f of formatAssignments) {
            const k = fmtKey(f);
            counts.set(k, (counts.get(k) || 0) + 1);
          }
        }

        const seedRand = masonrySeed ? mulberry32(xmur3(masonrySeed)()) : null;

        const pickAdditionalFormat = () => {
          const bestCol = pickBestCol();
          const maxH = (distributionBounds.height - (2 * spacing)) - heights[bestCol];
          if (maxH <= 0) return null;

          const candidates = (formatsForLayout || [])
            .filter(f => {
              const k = fmtKey(f);
              const max = f.max;
              if (max === undefined || max === null || isNaN(max)) return true;
              return (counts.get(k) || 0) < max;
            })
            .filter(f => {
              const w = Number(f.width) || 0;
              const h = Number(f.height) || 0;
              if (!uniformColWidth) return (h || 0) <= maxH;
              if (w <= 0 || h <= 0) return false;
              const scaledH = h * (colInnerW / w);
              return scaledH <= maxH;
            });

          if (candidates.length === 0) return null;
          candidates.sort((a, b) => (a.height - b.height) || (a.width - b.width));

          // pick among the smallest few for variety (seeded)
          const pickPoolSize = Math.min(3, candidates.length);
          const chosen = seedRand
            ? candidates[Math.floor(seedRand() * pickPoolSize)]
            : candidates[0];

          const k = fmtKey(chosen);
          counts.set(k, (counts.get(k) || 0) + 1);
          return { width: chosen.width, height: chosen.height };
        };

        // Masonry main loop, optionally extending with fill-page (requires empty frame creation)
        while (index < slotCount) {
          let item = items[index];
          let obj = item && item.object;

          if (!obj) {
            if (allowEmptyFrames) {
              obj = createEmptyFrame();
              createdEmpty++;
              item = { object: obj, width: 0, height: 0, bounds: obj.geometricBounds };
              items[index] = item;
            } else {
              index++;
              continue;
            }
          }

          const before = getBoundsData(obj);
          const label = obj && typeof obj.id !== "undefined" ? `ID ${obj.id}` : `Index ${index}`;

          let itemWidth, itemHeight;
          if (formatAssignments && formatAssignments[index]) {
            const baseW = Number(formatAssignments[index].width) || 0;
            const baseH = Number(formatAssignments[index].height) || 0;
            if (uniformColWidth && baseW > 0 && baseH > 0) {
              // Scale to fit column width, but only if format is wider than column
              // This preserves smaller formats while fitting larger ones
              if (baseW > colInnerW) {
                itemWidth = colInnerW;
                // multiKeepAspect: preserve aspect ratio when scaling
                itemHeight = multiKeepAspect ? (baseH * (colInnerW / baseW)) : baseH;
                appendLog(`  -> Format: ${baseW.toFixed(2)}x${baseH.toFixed(2)}mm -> ${itemWidth.toFixed(2)}x${itemHeight.toFixed(2)}mm (scaled to fit${multiKeepAspect ? ', aspect preserved' : ''})`);
              } else {
                itemWidth = baseW;
                itemHeight = baseH;
                appendLog(`  -> Format: ${itemWidth.toFixed(2)}x${itemHeight.toFixed(2)}mm (original size)`);
              }
            } else {
              itemWidth = baseW;
              itemHeight = baseH;
              appendLog(`  -> Format: ${itemWidth.toFixed(2)}x${itemHeight.toFixed(2)}mm`);
            }
          } else {
            itemWidth = uniformColWidth ? colInnerW : defaultItemWidth;
            itemHeight = defaultItemHeight;
          }

          const pos = placeMasonry(itemWidth, itemHeight);
          if (!pos) {
            appendLog(`  -> Item ${label} passt nicht mehr in den Bereich (übersprungen)`);
            index++;
            continue;
          }

          resizeItem(obj, itemWidth, itemHeight, {
            scaleFrame,
            scaleContent,
            keepCenter: false
          });

          obj.geometricBounds = [
            pos.newTop,
            pos.newLeft,
            pos.newTop + itemHeight,
            pos.newLeft + itemWidth
          ];

          const after = getBoundsData(obj);
          appendLog(`Verteilen & Skalieren -> ${label}: Start ${boundsToText(before)} | Ziel w=${itemWidth.toFixed(2)}, h=${itemHeight.toFixed(2)}, pos x=${pos.newLeft.toFixed(2)}, y=${pos.newTop.toFixed(2)} | Result ${boundsToText(after)}`);

          index++;

          if (masonryFillPage && allowEmptyFrames && formatAssignments && index >= slotCount) {
            const extra = pickAdditionalFormat();
            if (!extra) {
              break;
            }
            formatAssignments.push(extra);
            slotCount++;
          }
        }
      } else {
        for (let row = 0; row < rows && index < slotCount; row++) {
          for (let col = 0; col < cols && index < slotCount; col++) {
            let item = items[index];
            let obj = item && item.object;

            if (!obj) {
              if (formatMode === 'multi' && allowEmptyFrames) {
                obj = createEmptyFrame();
                createdEmpty++;
                item = { object: obj, width: 0, height: 0, bounds: obj.geometricBounds };
                items[index] = item;
              } else {
                index++;
                continue;
              }
            }

            const before = getBoundsData(obj);
            const label = obj && typeof obj.id !== "undefined" ? `ID ${obj.id}` : `Index ${index}`;

            // Bestimme Größe für dieses Objekt
            let itemWidth, itemHeight;
            if (formatAssignments && formatAssignments[index]) {
              itemWidth = formatAssignments[index].width;
              itemHeight = formatAssignments[index].height;
              appendLog(`  -> Format: ${itemWidth}x${itemHeight}mm`);
            } else {
              if (formatMode === 'single' && keepAspect) {
                const ow = Number(item && item.width) || 0;
                const oh = Number(item && item.height) || 0;
                if (ow > 0 && oh > 0) {
                  const s = Math.min(defaultItemWidth / ow, defaultItemHeight / oh);
                  itemWidth = ow * s;
                  itemHeight = oh * s;
                } else {
                  itemWidth = defaultItemWidth;
                  itemHeight = defaultItemHeight;
                }
              } else {
                itemWidth = defaultItemWidth;
                itemHeight = defaultItemHeight;
              }
            }

            // Berechne neue Position (cell-based, to avoid overlaps with variable format sizes)
            const cellLeft = distributionBounds.left + spacing + col * (cellW + spacing);
            const cellTop = distributionBounds.top + spacing + row * (cellH + spacing);
            const newLeft = cellLeft + (cellW - itemWidth) / 2;
            const newTop = cellTop + (cellH - itemHeight) / 2;

            // Skalieren (Frame/Content) mit derselben Logik wie Größenzuweisung
            resizeItem(obj, itemWidth, itemHeight, {
              scaleFrame,
              scaleContent,
              keepCenter: false // Nicht zentrieren, da wir Position setzen
            });

            // Setze Position direkt (move() ist in InDesign UXP nicht zuverlässig)
            // (Multi-Format requires scaleFrame=true; we already enforce that above.)
            obj.geometricBounds = [
              newTop,
              newLeft,
              newTop + itemHeight,
              newLeft + itemWidth
            ];

            const after = getBoundsData(obj);
            appendLog(`Verteilen & Skalieren -> ${label}: Start ${boundsToText(before)} | Ziel w=${itemWidth.toFixed(2)}, h=${itemHeight.toFixed(2)}, pos x=${newLeft.toFixed(2)}, y=${newTop.toFixed(2)} | Result ${boundsToText(after)}`);

            index++;
          }
        }
      }

      if (createdEmpty > 0) {
        appendLog(`Leere Rahmen erstellt: ${createdEmpty}`);
      }

      showMessage(t('msg.distributedScaled', { count: index }));

    } catch (error) {
      showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(error) }), true);
      console.error(error);
    }
  }

  const templatesFeature = createTemplatesFeature({
    appendLog,
    showMessage,
    t,
    formatErrorMessage,
    parseLocalizedFloat,
    roundToMax3Decimals,
    getPluginDataFolder,
    getRequestLivePreview: () => requestLivePreview
  });

  const { initTemplateWiring } = templatesFeature;

  // ============================
  // Event Listeners / Panel Init
  // ============================

  function debounce(fn, waitMs) {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn(...args);
      }, waitMs);
    };
  }

  function supportsUndo() {
    const app = getInDesignApp();
    if (!app) return false;
    try {
      return typeof app.undo === 'function';
    } catch (_) {
      return false;
    }
  }

  function tryUndoOnce() {
    const app = getInDesignApp();
    if (!app) return false;
    try {
      if (typeof app.undo !== 'function') return false;
      app.undo();
      return true;
    } catch (_) {
      return false;
    }
  }

  function hasActiveSelection() {
    const doc = getActiveDocumentSafe();
    try {
      return !!(doc && doc.selection && doc.selection.length > 0);
    } catch (_) {
      return false;
    }
  }

  function canLivePreviewResize() {
    if (!hasActiveSelection()) return false;
    const scaleFrame = !!(document.getElementById('resize-frame') && document.getElementById('resize-frame').checked);
    const scaleContent = !!(document.getElementById('resize-content') && document.getElementById('resize-content').checked);
    if (!scaleFrame && !scaleContent) return false;

    const widthEl = document.getElementById('resize-width');
    const heightEl = document.getElementById('resize-height');
    const lockBtn = document.getElementById('lock-proportion');
    const lockRatio = !!(lockBtn && lockBtn.classList.contains('active'));

    const width = widthEl ? parseLocalizedFloat(widthEl.value) : NaN;
    const height = heightEl ? parseLocalizedFloat(heightEl.value) : NaN;

    if (lockRatio) {
      const hasOneSide = (Number.isFinite(width) && width >= MIN_DIMENSION) || (Number.isFinite(height) && height >= MIN_DIMENSION);
      return hasOneSide;
    }

    return Number.isFinite(width) && Number.isFinite(height) && width >= MIN_DIMENSION && height >= MIN_DIMENSION;
  }

  function canLivePreviewDistribute() {
    if (!hasActiveSelection()) return false;
    const horizontal = !!(document.getElementById('distribute-horizontal') && document.getElementById('distribute-horizontal').checked);
    const vertical = !!(document.getElementById('distribute-vertical') && document.getElementById('distribute-vertical').checked);
    if (!horizontal && !vertical) return false;

    const gapEl = document.getElementById('distribute-gap');
    if (gapEl) {
      const raw = String(gapEl.value || '').trim();
      if (raw) {
        const gap = parseLocalizedFloat(raw);
        if (!Number.isFinite(gap) || gap < 0) return false;
      }
    }

    return true;
  }

  function livePreviewDistributeScaleRequiresUndo() {
    const formatMode = getCheckedRadioValue('format-mode', 'single');
    if (formatMode !== 'multi') return false;

    const allowEmptyFramesEl = document.getElementById('allow-empty-frames');
    const allowEmptyFrames = allowEmptyFramesEl ? !!allowEmptyFramesEl.checked : !!pluginSettings.allowEmptyFrames;

    const layoutStyleEl = document.getElementById('multi-layout-style');
    const style = layoutStyleEl ? String(layoutStyleEl.value || '') : String(pluginSettings.multiLayoutStyle || 'grid');

    const masonryFillEl = document.getElementById('masonry-fill-page');
    const masonryFillPage = masonryFillEl ? !!masonryFillEl.checked : !!pluginSettings.masonryFillPage;

    // These options can create additional objects; without undo this can quickly accumulate.
    return !!(allowEmptyFrames || (style === 'masonry' && masonryFillPage));
  }

  function canLivePreviewDistributeScale(state) {
    if (!hasActiveSelection()) return false;
    const overlapEl = document.getElementById('overlap-elements');
    const overlapEnabled = overlapEl ? !!overlapEl.checked : !!pluginSettings.overlapElements;

    let spacing = 0;
    if (!overlapEnabled) {
      const spacingEl = document.getElementById('spacing');
      const spacingRaw = spacingEl ? String(spacingEl.value || '').trim() : '';
      spacing = parseLocalizedFloat(spacingRaw);
      if (!Number.isFinite(spacing) || spacing < 0) return false;
    }

    const scaleFrame = !!(document.getElementById('scale-frame') && document.getElementById('scale-frame').checked);
    const scaleContent = !!(document.getElementById('scale-content') && document.getElementById('scale-content').checked);
    if (!scaleFrame && !scaleContent) return false;

    const formatMode = getCheckedRadioValue('format-mode', 'single');
    if (formatMode === 'multi') {
      // Multi-Format requires frames to be scaled, otherwise format sizes can't be applied.
      if (!scaleFrame) {
        if (state && !state.warnedNeedsFrame) {
          appendLog('Live-Vorschau: Multi-Format benötigt "Rahmen" aktiviert (sonst können die Formatgrößen nicht angewendet werden).');
          state.warnedNeedsFrame = true;
        }
        return false;
      }
      if (state) state.warnedNeedsFrame = false;

      if (!Array.isArray(definedFormats) || definedFormats.length === 0) {
        if (state && !state.warnedNoFormats) {
          appendLog('Live-Vorschau: Keine Formate definiert (Multi-Format) – füge zuerst mindestens ein Format hinzu.');
          state.warnedNoFormats = true;
        }
        return false;
      }
      if (state) state.warnedNoFormats = false;
    } else if (state) {
      // reset one-shot warnings when leaving multi mode
      state.warnedNoFormats = false;
      state.warnedNeedsFrame = false;
    }

    return true;
  }

  function canLivePreviewCenterContent() {
    return hasActiveSelection();
  }

  // ============================
  // Calendar Generation
  // ============================

  const calendarFeature = createCalendarFeature({
    getActiveDocumentSafe,
    appendLog,
    showMessage,
    t,
    formatErrorMessage,
    parseLocalizedFloat,
    roundToMax3Decimals,
    getPluginDataFolder,
    CALENDAR_PRESETS_FILENAME,
    ColorModel,
    ColorSpace
  });

  const {
    createCalendar,
    renderCalendarPresets,
    saveCalendarPresetHandler,
    loadCalendarPreset,
    deleteCalendarPreset
  } = calendarFeature;

  const toolsFeature = createToolsFeature({
    getActiveDocumentSafe,
    appendLog,
    showMessage,
    t,
    formatErrorMessage,
    FitOptions,
    getCheckedRadioValue,
    roundToMax3Decimals
  });

  const { applyCenterContent, applyFitToFrame, applyFlattenNestedFrames } = toolsFeature;

  const canLivePreviewFitToFrame = () => hasActiveSelection();

  const livePreviewRegistry = {
    resize: {
      checkboxId: 'preview-resize',
      debounceMs: 300,
      apply: () => applyResize(),
      canRun: () => canLivePreviewResize(),
      watchIds: ['resize-width', 'resize-height', 'resize-frame', 'resize-content', 'lock-proportion'],
      watchNames: []
    },
    distribute: {
      checkboxId: 'preview-distribute',
      debounceMs: 300,
      apply: () => applyDistribute(),
      canRun: () => canLivePreviewDistribute(),
      watchIds: ['distribute-horizontal', 'distribute-vertical', 'distribute-gap', 'grid-cols', 'grid-rows'],
      watchNames: ['distribution-area', 'distribution-method']
    },
    distributeScale: {
      checkboxId: 'preview-distribute-scale',
      debounceMs: 550,
      apply: () => applyDistributeScale(),
      canRun: (state) => canLivePreviewDistributeScale(state),
      watchIds: [
        'spacing',
        'overlap-elements',
        'scale-min-width', 'scale-max-width', 'scale-min-height', 'scale-max-height',
        'scale-frame', 'scale-content',
        'scale-keep-aspect',
        'allow-empty-frames',
        'scale-formats-to-fit',
        'multi-keep-aspect',
        'multi-layout-style',
        'masonry-preset', 'masonry-cols',
        'masonry-count-mode', 'masonry-target-count',
        'masonry-seed', 'masonry-fill-page'
      ],
      watchNames: ['scale-distribution-area', 'format-mode']
    },
    fitToFrame: {
      checkboxId: 'preview-fit-to-frame',
      debounceMs: 300,
      apply: () => applyFitToFrame(),
      canRun: () => canLivePreviewFitToFrame(),
      watchIds: [],
      watchNames: ['scale-mode']
    },
    centerContent: {
      checkboxId: 'preview-center-content',
      debounceMs: 250,
      apply: () => applyCenterContent(),
      canRun: () => canLivePreviewCenterContent(),
      watchIds: [],
      watchNames: []
    },
    preset: {
      checkboxId: 'preview-preset',
      debounceMs: 500,
      apply: async () => {
        const preset = getSelectedPreset();
        if (preset) {
          applyLayoutPreset(preset);
          await new Promise(resolve => setTimeout(resolve, 50));
          await applyDistributeScale();
        }
      },
      canRun: () => getSelectedPreset() !== null && hasActiveSelection(),
      watchIds: [],
      watchNames: []
    }
  };

  const livePreviewState = {
    resize: { enabled: false, applied: false, running: false, pending: false, cancelRequested: false, schedule: null, snapshot: null, createdObjects: [] },
    distribute: { enabled: false, applied: false, running: false, pending: false, cancelRequested: false, schedule: null, snapshot: null, createdObjects: [] },
    distributeScale: { enabled: false, applied: false, running: false, pending: false, cancelRequested: false, schedule: null, snapshot: null, createdObjects: [], warnedNoFormats: false, warnedNeedsFrame: false },
    fitToFrame: { enabled: false, applied: false, running: false, pending: false, cancelRequested: false, schedule: null, snapshot: null, createdObjects: [] },
    centerContent: { enabled: false, applied: false, running: false, pending: false, cancelRequested: false, schedule: null, snapshot: null, createdObjects: [] },
    preset: { enabled: false, applied: false, running: false, pending: false, cancelRequested: false, schedule: null, snapshot: null, createdObjects: [] }
  };

  function capturePreviewSnapshot() {
    const doc = getActiveDocumentSafe();
    if (!doc) return null;

    let selection = [];
    try {
      selection = doc.selection ? Array.from(doc.selection) : [];
    } catch (_) {
      selection = [];
    }

    const items = [];
    for (let i = 0; i < selection.length; i++) {
      const item = selection[i];
      if (!item) continue;

      let bounds = null;
      try {
        if (item.geometricBounds) bounds = Array.from(item.geometricBounds);
      } catch (_) {
        bounds = null;
      }

      const graphics = [];
      try {
        if (item.allGraphics && item.allGraphics.length) {
          for (let g = 0; g < item.allGraphics.length; g++) {
            const gr = item.allGraphics[g];
            if (!gr) continue;
            let gb = null;
            try { if (gr.geometricBounds) gb = Array.from(gr.geometricBounds); } catch (_) { gb = null; }
            let hs = null;
            let vs = null;
            try { hs = Number(gr.absoluteHorizontalScale); } catch (_) { hs = null; }
            try { vs = Number(gr.absoluteVerticalScale); } catch (_) { vs = null; }
            graphics.push({ graphic: gr, bounds: gb, hScale: hs, vScale: vs });
          }
        }
      } catch (_) {
        // ignore
      }

      items.push({ item, bounds, graphics });
    }

    return { items };
  }

  function restorePreviewSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.items)) return;
    // Restore frame bounds first
    snapshot.items.forEach((entry) => {
      try {
        if (entry && entry.item && entry.bounds && entry.item.geometricBounds) {
          entry.item.geometricBounds = entry.bounds;
        }
      } catch (_) {
        // ignore
      }
    });
    // Then restore graphics
    snapshot.items.forEach((entry) => {
      const list = entry && Array.isArray(entry.graphics) ? entry.graphics : [];
      list.forEach((g) => {
        try {
          if (!g || !g.graphic) return;
          if (typeof g.hScale === 'number' && !isNaN(g.hScale)) g.graphic.absoluteHorizontalScale = g.hScale;
          if (typeof g.vScale === 'number' && !isNaN(g.vScale)) g.graphic.absoluteVerticalScale = g.vScale;
          if (g.bounds && g.graphic.geometricBounds) g.graphic.geometricBounds = g.bounds;
        } catch (_) {
          // ignore
        }
      });
    });
  }

  function removeCreatedObjects(createdObjects) {
    if (!Array.isArray(createdObjects) || createdObjects.length === 0) return;
    for (let i = createdObjects.length - 1; i >= 0; i--) {
      const obj = createdObjects[i];
      try {
        if (obj && typeof obj.remove === 'function') obj.remove();
      } catch (_) {
        // ignore
      }
    }
  }

  function revertLivePreview(kind) {
    const st = livePreviewState[kind];
    if (!st) return;

    if (st.running) {
      st.cancelRequested = true;
      return;
    }

    try {
      removeCreatedObjects(st.createdObjects);
    } finally {
      st.createdObjects = [];
    }
    try {
      restorePreviewSnapshot(st.snapshot);
    } finally {
      st.snapshot = null;
      st.applied = false;
      st.pending = false;
      st.cancelRequested = false;
    }
  }

  function revertAllLivePreviews() {
    Object.keys(livePreviewState).forEach((k) => revertLivePreview(k));
  }

  function requestLivePreview(kind) {
    const st = livePreviewState[kind];
    if (!st || !st.enabled || typeof st.schedule !== 'function') return;
    st.schedule();
  }

  async function runLivePreview(kind) {
    const cfg = livePreviewRegistry[kind];
    const st = livePreviewState[kind];
    if (!cfg || !st || !st.enabled) return;

    const canRun = typeof cfg.canRun === 'function' ? cfg.canRun(st) : true;
    if (!canRun) return;

    if (st.running) {
      st.pending = true;
      return;
    }

    st.running = true;
    st.cancelRequested = false;
    const prevSuppress = typeof window !== 'undefined' ? window.__ppSuppressPopups : false;
    try {
      if (typeof window !== 'undefined') window.__ppSuppressPopups = true;

      // Always revert previous preview first (temporary preview behavior)
      if (st.applied) {
        revertLivePreview(kind);
      }

      // Capture snapshot so we can restore on disable/tab switch
      st.snapshot = capturePreviewSnapshot();
      st.createdObjects = [];

      try {
        if (typeof window !== 'undefined') {
          window.__ppLivePreviewContext = { isPreview: true, kind, createdObjects: st.createdObjects };
        }
        await cfg.apply();
        st.applied = true;
      } finally {
        try {
          if (typeof window !== 'undefined') window.__ppLivePreviewContext = null;
        } catch (_) {
          // ignore
        }
      }
    } finally {
      if (typeof window !== 'undefined') window.__ppSuppressPopups = prevSuppress;
      st.running = false;

      // If preview was disabled or a tab switch requested a revert during execution
      if (!st.enabled || st.cancelRequested) {
        revertLivePreview(kind);
      }

      if (st.pending) {
        st.pending = false;
        // queue next run quickly
        try { requestLivePreview(kind); } catch (_) { }
      }
    }
  }

  async function applyWithLivePreviewCommit(kind, applyFn) {
    const st = livePreviewState[kind];
    try {
      // If there is an active preview state, revert it first to commit a clean step.
      if (st && st.enabled && st.applied) {
        revertLivePreview(kind);
      }
      await applyFn();
    } finally {
      if (st) {
        st.applied = false;
        st.snapshot = null;
        st.createdObjects = [];
      }
    }
  }

  function initLivePreviewWiring() {
    const wire = (kind) => {
      const cfg = livePreviewRegistry[kind];
      const st = livePreviewState[kind];
      if (!cfg || !st) return;

      const toggle = document.getElementById(cfg.checkboxId);
      if (!toggle) return;

      st.schedule = debounce(() => {
        void runLivePreview(kind);
      }, cfg.debounceMs || 300);

      const onToggle = () => {
        st.enabled = !!toggle.checked;
        st.pending = false;
        st.cancelRequested = false;

        if (st.enabled) {
          if (Object.prototype.hasOwnProperty.call(st, 'warnedNoFormats')) st.warnedNoFormats = false;
          if (Object.prototype.hasOwnProperty.call(st, 'warnedNeedsFrame')) st.warnedNeedsFrame = false;
        }

        if (!st.enabled) {
          revertLivePreview(kind);
          return;
        }

        // run once immediately when enabled
        requestLivePreview(kind);
      };
      toggle.addEventListener('change', onToggle);
      onToggle();

      const watchEl = (el) => {
        if (!el) return;
        const tag = String(el.tagName || '').toUpperCase();
        const type = (el.getAttribute && el.getAttribute('type')) ? String(el.getAttribute('type')) : '';
        const isButton = tag === 'BUTTON';
        const events = isButton ? ['click'] : (type === 'checkbox' || type === 'radio') ? ['change'] : ['input', 'change'];
        events.forEach((ev) => {
          el.addEventListener(ev, () => {
            if (!st.enabled) return;
            requestLivePreview(kind);
          });
        });
      };

      (cfg.watchIds || []).forEach((id) => watchEl(document.getElementById(id)));
      (cfg.watchNames || []).forEach((name) => {
        document.querySelectorAll(`input[name="${name}"]`).forEach((el) => watchEl(el));
      });
    };

    Object.keys(livePreviewRegistry).forEach(wire);
  }

  // ============================
  // Preset Definitions & Application
  // ============================

  const presetsFeature = createPresetsFeature({
    appendLog,
    showMessage,
    t,
    formatErrorMessage,
    setVisible,
    getCheckedRadioValue,
    queueSaveSettings,
    getSettingsReady: () => settingsReady,
    getPluginSettings: () => pluginSettings,
    getDefinedFormats: () => definedFormats,
    setDefinedFormats: (formats) => { definedFormats = formats; },
    renderFormatList,
    getRequestLivePreview: () => requestLivePreview
  });

  const {
    applyLayoutPreset,
    updateFormatModeUI,
    updateMultiLayoutStyleUI,
    updateMasonryPresetUI,
    getSelectedPreset,
    setSelectedPreset
  } = presetsFeature;

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
    if (buildStamp) {
      const sha = (BUILD_GIT_SHA && BUILD_GIT_SHA !== '__GIT_SHA__') ? BUILD_GIT_SHA : '';
      const fallback = 'dev';
      buildStamp.textContent = sha || fallback;
      buildStamp.title = sha ? `git ${sha}` : fallback;

      Promise.resolve()
        .then(() => getManifestVersion())
        .then((version) => {
          const v = version ? `v${version}` : '';
          buildStamp.textContent = v && sha ? `${v} (${sha})` : (v || sha || fallback);
        })
        .catch(() => {
          // keep fallback
        });
    }

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
    if (logEl && logBuffer.length === 0) {
      if (String(logEl.textContent || '').trim() === 'Log bereit…') logEl.textContent = '';
    }

    // Track selection changes and log object count
    // Only create one interval - check if it already exists
    if (!window.__ppSelectionInterval) {
      let lastSelectionCount = -1;
      const checkSelection = () => {
        try {
          const { app } = require('indesign');
          if (app && app.activeDocument && app.activeDocument.selection) {
            const count = app.activeDocument.selection.length;
            if (count !== lastSelectionCount) {
              lastSelectionCount = count;
              appendLog(`📋 Auswahl: ${count} Objekt(e)`);
            }
          }
        } catch (e) {
          // Ignore - no document open or other error
        }
      };

      // Poll every 500ms for selection changes
      window.__ppSelectionInterval = setInterval(checkSelection, 500);
      // Initial check
      setTimeout(checkSelection, 100);
    }

    const gridSettingsEl = document.getElementById('grid-settings');
    const scaleFrameEl = document.getElementById('scale-frame');

    const updateGridSettingsUI = () => {
      if (!gridSettingsEl) return;
      const method = getCheckedRadioValue('distribution-method', 'auto');
      setVisible(gridSettingsEl, method === 'grid', 'flex');
      appendLog(`UI: grid-settings visible=${method === 'grid'}`);
    };

    // Tab Navigation
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');

        // Live preview should be temporary: revert when switching tabs.
        try { revertAllLivePreviews(); } catch (_) { }

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

          // If live preview is enabled for this tab, run once.
          try {
            if (targetTab === 'resize') requestLivePreview('resize');
            else if (targetTab === 'distribute') requestLivePreview('distribute');
            else if (targetTab === 'distribute-scale') requestLivePreview('distributeScale');
            else if (targetTab === 'presets') requestLivePreview('preset');
            else if (targetTab === 'calendar') {
              // Defer font loading to ensure DOM is ready
              setTimeout(() => {
                try {
                  populateFontDropdown();
                } catch (e) {
                  console.error('Calendar tab font loading error:', e);
                }
              }, 50);
            }
            else if (targetTab === 'tools') {
              requestLivePreview('fitToFrame');
              requestLivePreview('centerContent');
            }
          } catch (_) { }
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

    if (scaleFrameEl) {
      scaleFrameEl.addEventListener('change', () => {
        try { updateFormatModeUI(); } catch (_) { }
      });
    }

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
      addFormatBtn.addEventListener('click', () => {
        addFormat();
        try { requestLivePreview('distributeScale'); } catch (_) { }
      });
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
      clearFormatsBtn.addEventListener('click', () => {
        clearFormats();
        try { requestLivePreview('distributeScale'); } catch (_) { }
      });
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
    const toggleAllowEmptyFrames = document.getElementById('allow-empty-frames');
    const toggleKeepAspect = document.getElementById('scale-keep-aspect');
    const toggleMultiKeepAspect = document.getElementById('multi-keep-aspect');
    const toggleScaleFormatsToFit = document.getElementById('scale-formats-to-fit');
    const selectMultiLayoutStyle = document.getElementById('multi-layout-style');
    const masonrySettingsEl = document.getElementById('masonry-settings');
    const overlapElementsEl = document.getElementById('overlap-elements');
    const spacingEl = document.getElementById('spacing');
    const inputMasonryCols = document.getElementById('masonry-cols');
    const selectMasonryPreset = document.getElementById('masonry-preset');
    const selectMasonryCountMode = document.getElementById('masonry-count-mode');
    const masonryTargetCountRow = document.getElementById('masonry-target-count-row');
    const inputMasonryTargetCount = document.getElementById('masonry-target-count');
    const inputMasonrySeed = document.getElementById('masonry-seed');
    const toggleMasonryFillPage = document.getElementById('masonry-fill-page');
    const toggleMasonryUniformColWidth = document.getElementById('masonry-uniform-col-width');

    // Layout spacing: "Elemente überlappen" -> spacing=0 and disable spacing input.
    let lastSpacingBeforeOverlap = null;
    const applyOverlapSpacingUI = () => {
      const enabled = !!(overlapElementsEl && overlapElementsEl.checked);
      pluginSettings.overlapElements = enabled;

      if (spacingEl) {
        if (enabled) {
          if (lastSpacingBeforeOverlap === null) lastSpacingBeforeOverlap = String(spacingEl.value ?? '');
          spacingEl.value = '0';
          spacingEl.disabled = true;
        } else {
          spacingEl.disabled = false;
          if (String(spacingEl.value ?? '') === '0' && lastSpacingBeforeOverlap !== null) {
            spacingEl.value = lastSpacingBeforeOverlap;
          }
          lastSpacingBeforeOverlap = null;
        }
      }

      if (settingsReady) queueSaveSettings();
      try { requestLivePreview('distributeScale'); } catch (_) { }
    };

    if (overlapElementsEl) {
      overlapElementsEl.addEventListener('change', applyOverlapSpacingUI);
    }

    // Masonry preset/count UI
    const applyMasonryPresetUI = () => {
      const preset = selectMasonryPreset ? String(selectMasonryPreset.value || 'custom') : String(pluginSettings.masonryPreset || 'custom');
      pluginSettings.masonryPreset = preset;

      const isCustom = preset === 'custom';
      if (inputMasonryCols) {
        inputMasonryCols.disabled = !isCustom;
        // For fixed presets, reflect the value in the input for transparency.
        if (!isCustom && /^cols-\d+$/.test(preset)) {
          const n = parseInt(preset.replace('cols-', ''), 10);
          if (Number.isFinite(n) && n > 0) inputMasonryCols.value = String(n);
        }
      }

      if (settingsReady) queueSaveSettings();
      try { requestLivePreview('distributeScale'); } catch (_) { }
    };

    const applyMasonryCountUI = () => {
      const mode = selectMasonryCountMode ? String(selectMasonryCountMode.value || 'selection') : String(pluginSettings.masonryCountMode || 'selection');
      pluginSettings.masonryCountMode = mode;

      setVisible(masonryTargetCountRow, mode === 'manual', 'flex');
      if (inputMasonryTargetCount) {
        inputMasonryTargetCount.disabled = mode !== 'manual';
      }

      if (settingsReady) queueSaveSettings();
      try { requestLivePreview('distributeScale'); } catch (_) { }
    };

    if (selectMasonryPreset) {
      selectMasonryPreset.addEventListener('change', applyMasonryPresetUI);
    }
    if (selectMasonryCountMode) {
      selectMasonryCountMode.addEventListener('change', applyMasonryCountUI);
    }
    if (inputMasonryTargetCount) {
      inputMasonryTargetCount.addEventListener('input', () => {
        const v = parseInt(String(inputMasonryTargetCount.value || ''), 10);
        pluginSettings.masonryTargetCount = Number.isFinite(v) && v > 0 ? v : 0;
        if (settingsReady) queueSaveSettings();
        try { requestLivePreview('distributeScale'); } catch (_) { }
      });
    }

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

    const applyUIFontSizeWorkarounds = (fontPx) => {
      const base = `${fontPx}px`;
      const small = `${Math.max(1, fontPx - 1)}px`;

      // Tabs (top menu)
      document.querySelectorAll('.tabs > button.tab').forEach(btn => {
        btn.style.fontSize = base;
        btn.style.fontFamily = 'inherit';
      });

      // Primary action buttons ("Anwenden", "Verteilen", ...)
      document.querySelectorAll('button.btn-primary').forEach(btn => {
        btn.style.fontSize = base;
        btn.style.fontFamily = 'inherit';
      });

      // Log action buttons (often visible while tuning font-size)
      document.querySelectorAll('.log-actions > button').forEach(btn => {
        btn.style.fontSize = btn.classList.contains('btn-small') ? small : base;
        btn.style.fontFamily = 'inherit';
      });
    };

    const applySettings = () => {
      const font = roundToMax3Decimals(parseLocalizedFloat(inputFont.value)) || 11;
      const gap = roundToMax3Decimals(parseLocalizedFloat(inputGap.value)) || 8;
      const pad = roundToMax3Decimals(parseLocalizedFloat(inputPad.value)) || 12;
      const divider = roundToMax3Decimals(parseLocalizedFloat(inputDivider.value)) || 16;

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

      applyUIFontSizeWorkarounds(font);

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

    if (toggleAllowEmptyFrames) {
      toggleAllowEmptyFrames.addEventListener('change', () => {
        pluginSettings.allowEmptyFrames = !!toggleAllowEmptyFrames.checked;
        appendLog(`UI: allowEmptyFrames=${!!pluginSettings.allowEmptyFrames}`);
        if (settingsReady) queueSaveSettings();
      });
    }

    if (toggleKeepAspect) {
      toggleKeepAspect.addEventListener('change', () => {
        pluginSettings.scaleKeepAspect = !!toggleKeepAspect.checked;
        appendLog(`UI: scaleKeepAspect=${!!pluginSettings.scaleKeepAspect}`);
        if (settingsReady) queueSaveSettings();
      });
    }

    if (toggleScaleFormatsToFit) {
      toggleScaleFormatsToFit.addEventListener('change', () => {
        pluginSettings.scaleFormatsToFit = !!toggleScaleFormatsToFit.checked;
        appendLog(`UI: scaleFormatsToFit=${!!pluginSettings.scaleFormatsToFit}`);
        if (settingsReady) queueSaveSettings();
      });
    }

    if (toggleMultiKeepAspect) {
      toggleMultiKeepAspect.addEventListener('change', () => {
        pluginSettings.multiKeepAspect = !!toggleMultiKeepAspect.checked;
        appendLog(`UI: multiKeepAspect=${!!pluginSettings.multiKeepAspect}`);
        if (settingsReady) queueSaveSettings();
      });
    }

    if (selectMultiLayoutStyle) {
      selectMultiLayoutStyle.addEventListener('change', () => {
        pluginSettings.multiLayoutStyle = selectMultiLayoutStyle.value;
        appendLog(`UI: multiLayoutStyle=${pluginSettings.multiLayoutStyle}`);
        setVisible(masonrySettingsEl, pluginSettings.multiLayoutStyle === 'masonry', 'block');
        if (settingsReady) queueSaveSettings();
      });
    }

    if (logEl) {
      logEl.addEventListener('scroll', () => {
        try {
          const threshold = 12;
          logAutoScrollEnabled = (logEl.scrollTop + logEl.clientHeight) >= (logEl.scrollHeight - threshold);
        } catch (_) {
          // ignore
        }
      });
    }

    if (inputMasonryCols) {
      inputMasonryCols.addEventListener('input', () => {
        const v = parseInt(inputMasonryCols.value, 10);
        pluginSettings.masonryCols = Number.isFinite(v) && v > 0 ? v : 3;
        if (settingsReady) queueSaveSettings();
      });
    }

    if (inputMasonrySeed) {
      inputMasonrySeed.addEventListener('input', () => {
        pluginSettings.masonrySeed = String(inputMasonrySeed.value || '');
        if (settingsReady) queueSaveSettings();
      });
    }

    if (toggleMasonryFillPage) {
      toggleMasonryFillPage.addEventListener('change', () => {
        pluginSettings.masonryFillPage = !!toggleMasonryFillPage.checked;
        if (settingsReady) queueSaveSettings();
      });
    }

    if (toggleMasonryUniformColWidth) {
      toggleMasonryUniformColWidth.addEventListener('change', () => {
        pluginSettings.masonryUniformColWidth = !!toggleMasonryUniformColWidth.checked;
        if (settingsReady) queueSaveSettings();
        try { requestLivePreview('distributeScale'); } catch (_) { }
      });
    }

    // Proportion lock button
    const lockBtn = document.getElementById('lock-proportion');
    lockBtn.addEventListener('click', () => {
      lockBtn.classList.toggle('active');
      lockBtn.textContent = lockBtn.classList.contains('active') ? '⛓' : '🔗';
    });

    // Template Management
    initTemplateWiring();

    // Feature Buttons
    const applyResizeBtn = document.getElementById('apply-resize-btn');
    const applyDistributeBtn = document.getElementById('apply-distribute-btn');
    const applyDistributeScaleBtn = document.getElementById('apply-distribute-scale-btn');

    if (applyResizeBtn) applyResizeBtn.addEventListener('click', () => { void applyWithLivePreviewCommit('resize', applyResize); });
    if (applyDistributeBtn) applyDistributeBtn.addEventListener('click', () => { void applyWithLivePreviewCommit('distribute', applyDistribute); });
    if (applyDistributeScaleBtn) applyDistributeScaleBtn.addEventListener('click', () => { void applyWithLivePreviewCommit('distributeScale', applyDistributeScale); });

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
      centerContentBtn.addEventListener('click', () => { void applyWithLivePreviewCommit('centerContent', applyCenterContent); });
    }

    const scaleToFrameBtn = document.getElementById('scale-to-frame-btn');
    if (scaleToFrameBtn) {
      scaleToFrameBtn.addEventListener('click', () => { void applyWithLivePreviewCommit('fitToFrame', applyFitToFrame); });
    }

    const flattenFramesBtn = document.getElementById('flatten-frames-btn');
    if (flattenFramesBtn) {
      flattenFramesBtn.addEventListener('click', applyFlattenNestedFrames);
    }

    // Calendar Tab Button
    const createCalendarBtn = document.getElementById('btn-create-calendar');
    if (createCalendarBtn) {
      createCalendarBtn.addEventListener('click', createCalendar);
    }

    const saveCalendarPresetBtn = document.getElementById('btn-save-calendar-preset');
    if (saveCalendarPresetBtn) {
      saveCalendarPresetBtn.addEventListener('click', saveCalendarPresetHandler);
    }

    // Live preview wiring (checkboxes + debounced change listeners)
    initLivePreviewWiring();

    // Async init: load saved settings, apply language/tooltips, sync UI controls
    void (async () => {
      await loadSettings();

      // Load persisted multi-format definitions
      if (Array.isArray(pluginSettings.formats)) {
        definedFormats = pluginSettings.formats;
      } else {
        definedFormats = [];
      }

      // Load calendar presets
      await renderCalendarPresets();

      if (toggleLog) toggleLog.checked = !!pluginSettings.logEnabled;
      if (togglePopups) togglePopups.checked = !!pluginSettings.popupsEnabled;
      if (toggleAllowEmptyFrames) toggleAllowEmptyFrames.checked = !!pluginSettings.allowEmptyFrames;
      if (toggleKeepAspect) toggleKeepAspect.checked = (pluginSettings.scaleKeepAspect !== false);
      if (toggleMultiKeepAspect) toggleMultiKeepAspect.checked = (pluginSettings.multiKeepAspect !== false);
      if (toggleScaleFormatsToFit) toggleScaleFormatsToFit.checked = !!pluginSettings.scaleFormatsToFit;
      if (selectMultiLayoutStyle) selectMultiLayoutStyle.value = pluginSettings.multiLayoutStyle || 'grid';
      if (inputMasonryCols) inputMasonryCols.value = String(pluginSettings.masonryCols ?? 3);
      if (inputMasonrySeed) inputMasonrySeed.value = String(pluginSettings.masonrySeed ?? '');
      if (toggleMasonryFillPage) toggleMasonryFillPage.checked = !!pluginSettings.masonryFillPage;
      if (toggleMasonryUniformColWidth) toggleMasonryUniformColWidth.checked = !!pluginSettings.masonryUniformColWidth;
      if (overlapElementsEl) overlapElementsEl.checked = !!pluginSettings.overlapElements;
      if (selectMasonryPreset) selectMasonryPreset.value = String(pluginSettings.masonryPreset || 'custom');
      if (selectMasonryCountMode) selectMasonryCountMode.value = String(pluginSettings.masonryCountMode || 'selection');
      if (inputMasonryTargetCount) {
        const v = parseInt(String(pluginSettings.masonryTargetCount || ''), 10);
        if (Number.isFinite(v) && v > 0) inputMasonryTargetCount.value = String(v);
      }
      setVisible(masonrySettingsEl, (pluginSettings.multiLayoutStyle || 'grid') === 'masonry', 'block');
      if (selectLanguage) selectLanguage.value = getLanguage();

      // Initialize preset cards
      const presetCards = document.querySelectorAll('.preset-card');
      presetCards.forEach(card => {
        const presetKey = card.getAttribute('data-preset');

        // Translate preset names and descriptions
        const nameEl = card.querySelector('.preset-name');
        const descEl = card.querySelector('.preset-desc');
        if (nameEl && presetKey) {
          const camelKey = presetKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          nameEl.textContent = t(`preset.${camelKey}.name`) || nameEl.textContent;
        }
        if (descEl && presetKey) {
          const camelKey = presetKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          descEl.textContent = t(`preset.${camelKey}.desc`) || descEl.textContent;
        }

        card.addEventListener('click', () => {
          presetCards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          setSelectedPreset(presetKey);
          try { requestLivePreview('preset'); } catch (_) { }
        });
      });

      const transferPresetBtn = document.getElementById('transfer-preset-btn');
      if (transferPresetBtn) {
        transferPresetBtn.textContent = t('btn.transferPreset') || 'In Layout-Tab übernehmen';
        transferPresetBtn.addEventListener('click', () => {
          const preset = getSelectedPreset();
          if (preset) {
            applyLayoutPreset(preset);
            // Switch to Layout tab
            const layoutTab = document.querySelector('[data-tab="distribute-scale"]');
            if (layoutTab) layoutTab.click();
          } else {
            showMessage(t('msg.selectPreset'), true);
          }
        });
      }

      const applyPresetBtn = document.getElementById('apply-preset-btn');
      if (applyPresetBtn) {
        applyPresetBtn.textContent = t('btn.applyPreset');
        applyPresetBtn.addEventListener('click', async () => {
          const preset = getSelectedPreset();
          if (preset) {
            applyLayoutPreset(preset);
            // Wait a moment for UI to update, then apply distribute & scale
            setTimeout(() => {
              void applyWithLivePreviewCommit('distributeScale', applyDistributeScale);
            }, 100);
          } else {
            showMessage(t('msg.selectPreset'), true);
          }
        });
      }

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

      // Apply dependent UI state (after settings load)
      try { applyOverlapSpacingUI(); } catch (_) { }
      try { applyMasonryPresetUI(); } catch (_) { }
      try { applyMasonryCountUI(); } catch (_) { }

      // Ensure format list reflects loaded settings
      renderFormatList();

      settingsReady = true;
    })();

    const sha = (BUILD_GIT_SHA && BUILD_GIT_SHA !== '__GIT_SHA__') ? BUILD_GIT_SHA : 'dev';
    appendLog(`${t('msg.panelLoaded')} (${sha})`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    safeInitPanel('DOMContentLoaded');
  });