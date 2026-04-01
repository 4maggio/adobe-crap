/**
 * Fonts Module
 * Manages font loading and population for the calendar feature
 * @module fonts
 */

/**
 * Gets default system fonts as fallback
 * @returns {Array<string>} Array of default font names, sorted alphabetically
 */
function getDefaultFonts() {
    return ['Arial', 'Arial Black', 'Courier New', 'Georgia', 'Times New Roman',
        'Trebuchet MS', 'Verdana', 'Minion Pro', 'Garamond', 'Helvetica'].sort();
}

/**
 * Creates a font API for loading and managing fonts from InDesign
 * @param {Object} options - Configuration options
 * @param {Function} options.getInDesignApp - Function to get InDesign app instance
 * @param {Function} options.appendLog - Function to append log messages
 * @returns {Object} Object with loadAvailableFonts and populateFontDropdown methods
 */
function createFontApi({ getInDesignApp, appendLog }) {
    /**
     * Loads available fonts from InDesign
     * @returns {Array<string>} Array of available font names
     */
    function loadAvailableFonts() {
        try {
            const app = getInDesignApp();
            if (!app) {
                console.warn('InDesign app not available, using default fonts');
                return getDefaultFonts();
            }

            let fontList = [];
            try {
                if (app.fonts && app.fonts.length > 0) {
                    if (typeof appendLog === 'function') {
                        appendLog(`🔍 Lade ${app.fonts.length} Schriftarten...`);
                    }
                    for (let i = 0; i < app.fonts.length; i++) {
                        try {
                            const font = app.fonts[i];
                            if (font && font.name) {
                                fontList.push(font.name);
                            }
                        } catch (e) {
                            // Skip invalid font
                        }
                    }
                } else {
                    console.warn('No fonts available in app.fonts');
                }
            } catch (e) {
                console.error('Error accessing app.fonts:', e);
            }

            if (fontList.length > 0) {
                fontList.sort((a, b) => a.localeCompare(b));
                return fontList;
            }

            console.warn('No fonts loaded, using defaults');
            return getDefaultFonts();
        } catch (err) {
            console.error('loadAvailableFonts error:', err);
            return getDefaultFonts();
        }
    }

    /**
     * Populates the font dropdown select element with available fonts
     */
    function populateFontDropdown() {
        try {
            const fontSelect = document.getElementById('calendar-font-family');
            if (!fontSelect) {
                console.warn('calendar-font-family element not found');
                if (typeof appendLog === 'function') {
                    appendLog('⚠️ Schriftarten-Dropdown nicht gefunden');
                }
                return;
            }

            if (typeof appendLog === 'function') {
                appendLog('📝 Lade Schriftarten...');
            }

            // Get fonts from InDesign
            const fonts = loadAvailableFonts();

            if (!fonts || fonts.length === 0) {
                if (typeof appendLog === 'function') {
                    appendLog('⚠️ Keine Schriftarten verfügbar');
                }
                fontSelect.innerHTML = '<option>-- Keine Schriften verfügbar --</option>';
                return;
            }

            // Clear and rebuild dropdown
            fontSelect.innerHTML = '';

            // Add placeholder
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '-- Schrift wählen --';
            fontSelect.appendChild(placeholder);

            // Add all fonts
            fonts.forEach(fontName => {
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = fontName;
                fontSelect.appendChild(option);
            });

            if (typeof appendLog === 'function') {
                appendLog(`✅ ${fonts.length} Schriftarten geladen`);
            }
        } catch (err) {
            console.error('populateFontDropdown error:', err);
            if (typeof appendLog === 'function') {
                appendLog(`❌ Fehler beim Laden der Schriften: ${err.message}`);
            }

            // Fallback: show error in dropdown
            const fontSelect = document.getElementById('calendar-font-family');
            if (fontSelect) {
                fontSelect.innerHTML = '<option>-- Fehler beim Laden --</option>';
            }
        }
    }

    return {
        loadAvailableFonts,
        populateFontDropdown
    };
}
    function loadAvailableFonts() {
        try {
            const app = getInDesignApp();
            if (!app) {
                console.warn('InDesign app not available, using default fonts');
                return getDefaultFonts();
            }

            let fontList = [];
            try {
                if (app.fonts && app.fonts.length > 0) {
                    if (typeof appendLog === 'function') {
                        appendLog(`🔍 Lade ${app.fonts.length} Schriftarten...`);
                    }
                    for (let i = 0; i < app.fonts.length; i++) {
                        try {
                            const font = app.fonts[i];
                            if (font && font.name) {
                                fontList.push(font.name);
                            }
                        } catch (e) {
                            // Skip invalid font
                        }
                    }
                } else {
                    console.warn('No fonts available in app.fonts');
                }
            } catch (e) {
                console.error('Error accessing app.fonts:', e);
            }

            if (fontList.length > 0) {
                fontList.sort((a, b) => a.localeCompare(b));
                return fontList;
            }

            console.warn('No fonts loaded, using defaults');
            return getDefaultFonts();
        } catch (err) {
            console.error('loadAvailableFonts error:', err);
            return getDefaultFonts();
        }
    }

    function populateFontDropdown() {
        try {
            const fontSelect = document.getElementById('calendar-font-family');
            if (!fontSelect) {
                console.warn('calendar-font-family element not found');
                if (typeof appendLog === 'function') {
                    appendLog('⚠️ Schriftarten-Dropdown nicht gefunden');
                }
                return;
            }

            if (typeof appendLog === 'function') {
                appendLog('📝 Lade Schriftarten...');
            }

            // Get fonts from InDesign
            const fonts = loadAvailableFonts();

            if (!fonts || fonts.length === 0) {
                if (typeof appendLog === 'function') {
                    appendLog('⚠️ Keine Schriftarten verfügbar');
                }
                fontSelect.innerHTML = '<option>-- Keine Schriften verfügbar --</option>';
                return;
            }

            // Clear and rebuild dropdown
            fontSelect.innerHTML = '';

            // Add placeholder
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '-- Schrift wählen --';
            fontSelect.appendChild(placeholder);

            // Add all fonts
            fonts.forEach(fontName => {
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = fontName;
                fontSelect.appendChild(option);
            });

            if (typeof appendLog === 'function') {
                appendLog(`✅ ${fonts.length} Schriftarten geladen`);
            }
        } catch (err) {
            console.error('populateFontDropdown error:', err);
            if (typeof appendLog === 'function') {
                appendLog(`❌ Fehler beim Laden der Schriften: ${err.message}`);
            }

            // Fallback: show error in dropdown
            const fontSelect = document.getElementById('calendar-font-family');
            if (fontSelect) {
                fontSelect.innerHTML = '<option>-- Fehler beim Laden --</option>';
            }
        }
    }

    return {
        loadAvailableFonts,
        populateFontDropdown
    };
}

module.exports = {
    getDefaultFonts,
    createFontApi
};
