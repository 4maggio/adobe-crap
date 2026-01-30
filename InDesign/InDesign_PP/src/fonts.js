function getDefaultFonts() {
    return ['Arial', 'Arial Black', 'Courier New', 'Georgia', 'Times New Roman',
        'Trebuchet MS', 'Verdana', 'Minion Pro', 'Garamond', 'Helvetica'].sort();
}

function createFontApi({ getInDesignApp, appendLog }) {
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
