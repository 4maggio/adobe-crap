function createUIHelpers({ t }) {
    function applyLanguageToUI() {
        // Tabs
        const tabMap = {
            resize: "tabs.resize",
            distribute: "tabs.distribute",
            "distribute-scale": "tabs.distributeScale",
            presets: "tabs.presets",
            tools: "tabs.tools",
            settings: "tabs.settings"
        };
        document.querySelectorAll(".tab[data-tab]").forEach((btn) => {
            const key = tabMap[btn.getAttribute("data-tab")];
            if (!key) return;
            const label = btn.querySelector('.tab-label');
            if (label) {
                label.textContent = t(key);
            } else {
                // Back-compat if markup changes
                btn.textContent = t(key);
            }
        });

        // Headings / helper texts
        const setTextById = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.textContent = t(key);
        };
        setTextById("title-templates", "title.templates");
        setTextById("title-format-definition", "title.formatDefinition");
        setTextById("title-size-constraints", "title.sizeConstraints");
        setTextById("label-scale-keep-aspect", "label.scaleKeepAspect");
        setTextById("help-scale-keep-aspect", "help.scaleKeepAspect");
        setTextById("label-multi-keep-aspect", "label.multiKeepAspect");
        setTextById("help-multi-keep-aspect", "help.multiKeepAspect");
        setTextById("title-multi-formats", "title.multiFormats");
        setTextById("label-formats-define", "label.formatsDefine");
        setTextById("label-format-add", "label.formatAdd");
        setTextById("help-format-minmax", "help.formatMinMax");
        setTextById("label-allow-empty-frames", "label.allowEmptyFrames");
        setTextById("help-allow-empty-frames", "help.allowEmptyFrames");
        setTextById("label-scale-formats-to-fit", "label.scaleFormatsToFit");
        setTextById("help-scale-formats-to-fit", "help.scaleFormatsToFit");
        setTextById("help-multi-format-needs-frame", "help.multiFormatNeedsFrame");
        setTextById("label-multi-layout-style", "label.multiLayoutStyle");

        const optGrid = document.querySelector('#multi-layout-style option[value="grid"]');
        if (optGrid) optGrid.textContent = t('ui.layout.grid');
        const optMasonry = document.querySelector('#multi-layout-style option[value="masonry"]');
        if (optMasonry) optMasonry.textContent = t('ui.layout.masonry');

        setTextById('label-masonry-settings', 'label.masonrySettings');
        setTextById('label-masonry-cols', 'label.masonryCols');
        setTextById('label-masonry-seed', 'label.masonrySeed');
        setTextById('label-masonry-fill-page', 'label.masonryFillPage');
        setTextById('help-masonry', 'help.masonry');
        setTextById("title-plugin-settings", "title.plugin");
        setTextById("help-distribute", "help.distribute");
        setTextById("help-distribute-scale", "help.distributeScale");
        setTextById("help-tools", "help.tools");
        setTextById("title-center-content", "title.centerContent");
        setTextById("help-center-content", "help.centerContent");
        setTextById("title-fit-to-frame", "title.fitToFrame");

        // Calendar controls
        setTextById("title-calendar", "title.calendar");
        setTextById("help-calendar", "help.calendar");
        setTextById("label-calendar-year", "label.calendarYear");
        setTextById("label-calendar-month", "label.calendarMonth");
        setTextById("label-calendar-layout", "label.calendarLayout");
        setTextById("help-calendar-layout", "help.calendarLayout");
        setTextById("label-calendar-start-day", "label.calendarStartDay");
        setTextById("help-calendar-start-day", "help.calendarStartDay");
        setTextById("label-calendar-cell-width", "label.calendarCellWidth");
        setTextById("label-calendar-cell-height", "label.calendarCellHeight");
        setTextById("label-calendar-show-week-numbers", "label.calendarShowWeekNumbers");
        setTextById("label-calendar-show-weekdays", "label.calendarShowWeekdays");
        setTextById("label-calendar-weekday-format", "label.calendarWeekdayFormat");
        setTextById("label-calendar-font-family", "label.calendarFontFamily");
        setTextById("label-calendar-font-size", "label.calendarFontSize");
        setTextById("label-calendar-weekday-colors", "label.calendarWeekdayColors");
        setTextById("label-calendar-presets-title", "label.calendarPresetsTitle");
        setTextById("btn-create-calendar-text", "btn.createCalendar");

        // Live preview labels
        setTextById("label-preview-resize", "ui.livePreview");
        setTextById("label-preview-distribute", "ui.livePreview");
        setTextById("label-preview-distribute-scale", "ui.livePreview");
        setTextById("label-preview-fit-to-frame", "ui.livePreview");
        setTextById("label-preview-center-content", "ui.livePreview");

        setTextById("label-overlap-elements", "ui.overlapElements");

        // Masonry preset / count controls
        setTextById('label-masonry-preset', 'label.masonryPreset');
        setTextById('label-masonry-count-mode', 'label.masonryCountMode');
        setTextById('label-masonry-target-count', 'label.masonryTargetCount');
        setTextById('opt-masonry-preset-auto', 'ui.masonryPreset.auto');
        setTextById('opt-masonry-preset-custom', 'ui.masonryPreset.custom');
        const presetCols = [1, 2, 3, 4, 5];
        presetCols.forEach((n) => {
            const el = document.getElementById(`opt-masonry-preset-${n}`);
            if (el) el.textContent = t('ui.masonryPreset.cols', { n });
        });
        setTextById('opt-masonry-count-selection', 'ui.masonryCount.selection');
        setTextById('opt-masonry-count-manual', 'ui.masonryCount.manual');

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
        setBtn("flatten-frames-btn", "btn.flattenFrames");
        setBtn("btn-save-calendar-preset", "btn.saveCalendarPreset");
        setBtn("add-format-btn", "btn.addFormat");
        setBtn("cancel-edit-format-btn", "btn.cancel");
        setBtn("clear-formats-btn", "btn.clearFormats");
        setBtn("copy-log-btn", "btn.copyLog");
        setBtn("clear-log-btn", "btn.clearLog");
    }

    function applyTooltips() {
        const overrides = {
            "lock-proportion": "tooltip.lockRatio",
            "apply-resize-btn": "tooltip.applyResize",
            "apply-distribute-btn": "tooltip.applyDistribute",
            "apply-distribute-scale-btn": "tooltip.applyDistributeScale",
            "center-content-btn": "tooltip.centerContent",
            "scale-to-frame-btn": "tooltip.fitToFrame",
            "flatten-frames-btn": "tooltip.flattenFrames",
            "copy-log-btn": "tooltip.copyLog",
            "clear-log-btn": "tooltip.clearLog",
            "format-list": "tooltip.formatsList",
            "format-width": "tooltip.formatWidth",
            "format-height": "tooltip.formatHeight",
            "format-min": "tooltip.formatMin",
            "format-max": "tooltip.formatMax",
            "preview-resize": "tooltip.livePreview",
            "preview-distribute": "tooltip.livePreview",
            "preview-distribute-scale": "tooltip.livePreview",
            "preview-fit-to-frame": "tooltip.livePreview",
            "preview-center-content": "tooltip.livePreview",
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

    return {
        applyLanguageToUI,
        applyTooltips
    };
}

module.exports = {
    createUIHelpers
};
