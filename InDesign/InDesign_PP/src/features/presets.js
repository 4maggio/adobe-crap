/**
 * Presets Feature Module
 * Manages layout presets and preset-related UI
 * @module features/presets
 */

/**
 * Creates the presets feature for managing layout presets
 * @param {Object} context - Shared context object containing dependencies
 * @returns {Object} Object with functions for preset management
 */
function createPresetsFeature(context) {
    const {
        appendLog,
        showMessage,
        t,
        formatErrorMessage,
        setVisible,
        getCheckedRadioValue,
        queueSaveSettings,
        getSettingsReady,
        getPluginSettings,
        getDefinedFormats,
        setDefinedFormats,
        renderFormatList,
        getRequestLivePreview
    } = context;

    // Preset definitions with relative sizes (percentages of page dimensions)
    // Format: { widthPct, heightPct, min, max } where widthPct/heightPct are 0-100
    const layoutPresets = {
        'hero-center': {
            formats: [
                { widthPct: 20, heightPct: 30, min: 1, max: 1 },  // Left top: small
                { widthPct: 35, heightPct: 20, min: 1, max: 1 },  // Center top: spacer (increased from 15%)
                { widthPct: 20, heightPct: 30, min: 1, max: 1 },  // Right top: small
                { widthPct: 35, heightPct: 50, min: 1, max: 1 },  // Center: Hero (reduced from 55%)
                { widthPct: 20, heightPct: 30, min: 3, max: 0 }   // Remaining: fill left+right columns
            ],
            mode: 'multi',
            layoutStyle: 'masonry',
            masonryPreset: 'cols-3',
            uniformColWidth: false,
            spacing: 5,
            scaleFormatsToFit: true,
            allowEmptyFrames: true
        },
        'masonry-2col': {
            formats: [
                { widthPct: 45, heightPct: 34, min: 0, max: 0 },  // Increased from 30% for proper 2-col layout
                { widthPct: 45, heightPct: 40, min: 0, max: 0 }
            ],
            mode: 'multi',
            layoutStyle: 'masonry',
            masonryPreset: 'cols-2',
            uniformColWidth: false,
            spacing: 5
        },
        'masonry-3col': {
            formats: [
                { widthPct: 30, heightPct: 27, min: 0, max: 0 },  // Increased from 24% for proper 3-col layout
                { widthPct: 30, heightPct: 40, min: 0, max: 0 },
                { widthPct: 30, heightPct: 34, min: 0, max: 0 }
            ],
            mode: 'multi',
            layoutStyle: 'masonry',
            masonryPreset: 'cols-3',
            uniformColWidth: false,
            spacing: 5
        },
        'grid-2x2': {
            formats: [],
            mode: 'single',
            layoutStyle: 'grid',
            spacing: 5
        },
        'grid-3x3': {
            formats: [],
            mode: 'single',
            layoutStyle: 'grid',
            spacing: 5
        },
        'grid-4x4': {
            formats: [],
            mode: 'single',
            layoutStyle: 'grid',
            spacing: 5
        },
        'l-layout': {
            formats: [
                { widthPct: 45, heightPct: 67, min: 1, max: 1 },  // Large left
                { widthPct: 20, heightPct: 24, min: 3, max: 0 }   // Small right
            ],
            mode: 'multi',
            layoutStyle: 'grid',
            spacing: 5,
            scaleFormatsToFit: true
        },
        'magazine': {
            formats: [
                { widthPct: 40, heightPct: 40, min: 1, max: 1 },
                { widthPct: 20, heightPct: 24, min: 2, max: 0 },
                { widthPct: 20, heightPct: 60, min: 1, max: 1 }
            ],
            mode: 'multi',
            layoutStyle: 'grid',
            spacing: 5,
            scaleFormatsToFit: true
        },
        'hero-stack': {
            formats: [
                { widthPct: 20, heightPct: 28, min: 2, max: 2 },  // Left: 2 small
                { widthPct: 35, heightPct: 15, min: 1, max: 1 },  // Center top: spacer (increased from 12%)
                { widthPct: 20, heightPct: 28, min: 2, max: 2 },  // Right: 2 small
                { widthPct: 35, heightPct: 42, min: 1, max: 1 },  // Center: Hero (reduced from 45%)
                { widthPct: 35, heightPct: 15, min: 1, max: 1 },  // Center bottom: spacer (increased from 12%)
                { widthPct: 20, heightPct: 28, min: 0, max: 0 }   // Additional small for sides
            ],
            mode: 'multi',
            layoutStyle: 'masonry',
            masonryPreset: 'cols-3',
            uniformColWidth: false,
            spacing: 5,
            scaleFormatsToFit: true,
            allowEmptyFrames: true
        },
        'collage': {
            formats: [
                { widthPct: 30, heightPct: 34, min: 0, max: 0 },
                { widthPct: 20, heightPct: 34, min: 0, max: 0 },
                { widthPct: 25, heightPct: 40, min: 0, max: 0 },
                { widthPct: 25, heightPct: 27, min: 0, max: 0 }
            ],
            mode: 'multi',
            layoutStyle: 'masonry',
            masonryPreset: 'auto',
            uniformColWidth: false,
            spacing: 5
        }
    };

    // Convert relative preset formats to absolute sizes based on page dimensions
    function calculateAbsoluteFormats(formats, pageWidth, pageHeight) {
        if (!formats || formats.length === 0) return [];

        return formats.map(f => {
            // If format uses percentage values, convert to mm
            if (f.widthPct !== undefined && f.heightPct !== undefined) {
                return {
                    width: (pageWidth * f.widthPct / 100),
                    height: (pageHeight * f.heightPct / 100),
                    min: f.min,
                    max: f.max
                };
            }
            // Otherwise return as-is (backwards compatibility)
            return { ...f };
        });
    }

    let selectedPreset = null;

    function getSelectedPreset() {
        return selectedPreset;
    }

    function setSelectedPreset(presetKey) {
        selectedPreset = presetKey || null;
    }

    // UI Update Functions (müssen vor applyLayoutPreset definiert sein)
    function updateFormatModeUI() {
        const singleFormatEl = document.getElementById('single-format-settings');
        const multiFormatEl = document.getElementById('multi-format-settings');
        const multiNeedsFrameHintEl = document.getElementById('help-multi-format-needs-frame');
        const scaleFrameEl = document.getElementById('scale-frame');

        const mode = getCheckedRadioValue('format-mode', 'single');
        setVisible(singleFormatEl, mode === 'single', 'block');
        setVisible(multiFormatEl, mode === 'multi', 'block');

        if (multiNeedsFrameHintEl) {
            const scaleFrameChecked = !!(scaleFrameEl && scaleFrameEl.checked);
            setVisible(multiNeedsFrameHintEl, mode === 'multi' && !scaleFrameChecked, 'block');
        }

        appendLog(`UI: format-settings mode=${mode}`);
    }

    function updateMultiLayoutStyleUI() {
        const pluginSettings = getPluginSettings ? (getPluginSettings() || {}) : {};
        const masonrySettingsEl = document.getElementById('masonry-settings');
        const multiLayoutStyle = pluginSettings.multiLayoutStyle || 'grid';
        setVisible(masonrySettingsEl, multiLayoutStyle === 'masonry', 'block');
    }

    function updateMasonryPresetUI() {
        const pluginSettings = getPluginSettings ? (getPluginSettings() || {}) : {};
        const selectMasonryPreset = document.getElementById('masonry-preset');
        const inputMasonryCols = document.getElementById('masonry-cols');
        const preset = selectMasonryPreset ? String(selectMasonryPreset.value || 'custom') : String(pluginSettings.masonryPreset || 'custom');
        pluginSettings.masonryPreset = preset;

        const isCustom = preset === 'custom';
        if (inputMasonryCols) {
            inputMasonryCols.disabled = !isCustom;
            if (!isCustom && /^cols-\d+$/.test(preset)) {
                const n = parseInt(preset.replace('cols-', ''), 10);
                if (Number.isFinite(n) && n > 0) inputMasonryCols.value = String(n);
            }
        }

        if (getSettingsReady && getSettingsReady()) {
            queueSaveSettings();
        }

        try {
            const requestLivePreview = getRequestLivePreview ? getRequestLivePreview() : null;
            if (requestLivePreview) requestLivePreview('distributeScale');
        } catch (_) {
            // ignore
        }
    }

    function applyLayoutPreset(presetKey) {
        const preset = layoutPresets[presetKey];
        if (!preset) {
            showMessage(t('msg.selectPreset'), true);
            return;
        }

        try {
            // Get current page size to calculate absolute formats
            let pageWidth = 420;  // Default A4 landscape width
            let pageHeight = 297; // Default A4 landscape height

            try {
                const { app } = require('indesign');
                const doc = app.activeDocument;
                if (doc && doc.pages.length > 0) {
                    const page = doc.pages[0];
                    const bounds = page.bounds;
                    pageWidth = Math.abs(bounds[3] - bounds[1]);
                    pageHeight = Math.abs(bounds[2] - bounds[0]);
                }
            } catch (e) {
                console.warn('Could not get page size, using defaults:', e);
            }

            const pluginSettings = getPluginSettings ? (getPluginSettings() || {}) : {};
            const currentFormats = getDefinedFormats ? (getDefinedFormats() || []) : [];

            // Apply formats (convert relative to absolute sizes)
            if (preset.formats && preset.formats.length > 0) {
                const absoluteFormats = calculateAbsoluteFormats(preset.formats, pageWidth, pageHeight);
                if (setDefinedFormats) setDefinedFormats(absoluteFormats);
                else currentFormats.splice(0, currentFormats.length, ...absoluteFormats);
                pluginSettings.formats = absoluteFormats;
                renderFormatList();
            }

            // Set format mode
            const modeRadio = document.getElementById(`format-mode-${preset.mode}`);
            if (modeRadio) {
                modeRadio.checked = true;
                updateFormatModeUI();
            }

            // Set layout style
            const layoutStyleEl = document.getElementById('multi-layout-style');
            if (layoutStyleEl && preset.layoutStyle) {
                layoutStyleEl.value = preset.layoutStyle;
                pluginSettings.multiLayoutStyle = preset.layoutStyle;
                updateMultiLayoutStyleUI();
            }

            // Set masonry preset
            if (preset.masonryPreset) {
                const masonryPresetEl = document.getElementById('masonry-preset');
                if (masonryPresetEl) {
                    masonryPresetEl.value = preset.masonryPreset;
                    pluginSettings.masonryPreset = preset.masonryPreset;
                    updateMasonryPresetUI();
                }
            }

            // Set uniform column width
            if (preset.uniformColWidth !== undefined) {
                const uniformEl = document.getElementById('masonry-uniform-col-width');
                if (uniformEl) {
                    uniformEl.checked = preset.uniformColWidth;
                    pluginSettings.masonryUniformColWidth = preset.uniformColWidth;
                }
            }

            // Set spacing
            if (preset.spacing !== undefined) {
                const spacingEl = document.getElementById('spacing');
                if (spacingEl) {
                    spacingEl.value = String(preset.spacing);
                    pluginSettings.spacing = preset.spacing;
                }
            }

            // Set scaleFormatsToFit if specified in preset
            if (preset.scaleFormatsToFit !== undefined) {
                const scaleFormatsEl = document.getElementById('scale-formats-to-fit');
                if (scaleFormatsEl) {
                    scaleFormatsEl.checked = preset.scaleFormatsToFit;
                    pluginSettings.scaleFormatsToFit = preset.scaleFormatsToFit;
                }
            }

            // Set allowEmptyFrames if specified in preset
            if (preset.allowEmptyFrames !== undefined) {
                const allowEmptyEl = document.getElementById('allow-empty-frames');
                if (allowEmptyEl) {
                    allowEmptyEl.checked = preset.allowEmptyFrames;
                    pluginSettings.allowEmptyFrames = preset.allowEmptyFrames;
                }
            }

            queueSaveSettings();

            // Convert preset key to translation key
            // hero-center → heroCenter, masonry-2col → masonry2, masonry-3col → masonry3
            let translationKey = presetKey;
            if (presetKey === 'masonry-2col') translationKey = 'masonry2';
            else if (presetKey === 'masonry-3col') translationKey = 'masonry3';
            else translationKey = presetKey.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

            const presetName = t(`preset.${translationKey}.name`) || presetKey;
            appendLog(`✨ Preset "${presetName}" angewendet`);
            showMessage(t('msg.presetApplied', { name: presetName }));

        } catch (error) {
            showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(error) }), true);
            console.error(error);
        }
    }

    return {
        applyLayoutPreset,
        updateFormatModeUI,
        updateMultiLayoutStyleUI,
        updateMasonryPresetUI,
        getSelectedPreset,
        setSelectedPreset
    };
}

module.exports = {
    createPresetsFeature
};
