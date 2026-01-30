function createCalendarFeature(context) {
    const {
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
    } = context;

    let calendarPresets = [];

    async function loadCalendarPresets() {
        try {
            const folder = await getPluginDataFolder();
            const entries = await folder.getEntries();

            let presetsFile = null;
            for (const entry of entries) {
                if (entry && entry.name === CALENDAR_PRESETS_FILENAME) {
                    presetsFile = entry;
                    break;
                }
            }

            if (!presetsFile) {
                return [];
            }

            const contents = await presetsFile.read();
            const parsed = JSON.parse(contents);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error('Fehler beim Laden der Kalender-Vorlagen:', e);
            return [];
        }
    }

    async function saveCalendarPresets(presets) {
        try {
            if (!Array.isArray(presets)) return;

            const folder = await getPluginDataFolder();
            const presetsFile = await folder.createFile(CALENDAR_PRESETS_FILENAME, { overwrite: true });
            await presetsFile.write(JSON.stringify(presets, null, 2));

            appendLog(`${presets.length} Kalender-Vorlage(n) gespeichert`);
        } catch (e) {
            console.error("Fehler beim Speichern der Kalender-Vorlagen:", e);
            appendLog('Fehler beim Speichern: ' + e.message);
            showMessage(t('msg.templatesSaveFailed', { message: formatErrorMessage(e) }), true);
        }
    }

    async function renderCalendarPresets() {
        calendarPresets = await loadCalendarPresets();
        const listEl = document.getElementById('calendar-preset-list');

        if (!listEl) return;

        listEl.innerHTML = '';

        if (calendarPresets.length === 0) {
            listEl.innerHTML = `<div class="helper-text" style="padding: 8px; font-size: 12px;">Keine Vorlagen</div>`;
            return;
        }

        calendarPresets.forEach((preset, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'template-item';
            itemDiv.setAttribute('data-index', index.toString());
            itemDiv.style.padding = '6px';
            itemDiv.style.marginBottom = '4px';
            itemDiv.style.borderRadius = '3px';
            itemDiv.style.backgroundColor = '#f0f0f0';
            itemDiv.style.display = 'flex';
            itemDiv.style.justifyContent = 'space-between';
            itemDiv.style.alignItems = 'center';

            const nameSpan = document.createElement('span');
            nameSpan.style.cursor = 'pointer';
            nameSpan.style.flex = '1';
            nameSpan.textContent = preset.name;
            nameSpan.addEventListener('click', () => loadCalendarPreset(index));

            const deleteBtn = document.createElement('button');
            deleteBtn.style.padding = '2px 6px';
            deleteBtn.style.fontSize = '11px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => deleteCalendarPreset(index));

            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(deleteBtn);
            listEl.appendChild(itemDiv);
        });
    }

    function loadCalendarPreset(index) {
        try {
            if (calendarPresets[index]) {
                const preset = calendarPresets[index];
                appendLog(`📥 Lade Kalender-Vorlage: ${preset.name}`);

                document.getElementById('calendar-year').value = preset.year;
                document.getElementById('calendar-month').value = preset.month;
                document.getElementById('calendar-layout').value = preset.layout;
                document.getElementById('calendar-start-day').value = preset.startDay;
                document.getElementById('calendar-cell-width').value = preset.cellWidth;
                document.getElementById('calendar-cell-height').value = preset.cellHeight;
                document.getElementById('calendar-show-week-numbers').checked = preset.showWeekNumbers || false;
                document.getElementById('calendar-show-weekdays').checked = preset.showWeekdays !== false;
                document.getElementById('calendar-weekday-format').value = preset.weekdayFormat || 'medium';
                document.getElementById('calendar-font-family').value = preset.fontFamily || 'Arial';
                document.getElementById('calendar-font-size').value = preset.fontSize || 10;

                // Load colors
                if (preset.weekdayColors && Array.isArray(preset.weekdayColors) && preset.weekdayColors.length === 7) {
                    document.getElementById('calendar-color-sunday').value = preset.weekdayColors[0] || '#000000';
                    document.getElementById('calendar-color-monday').value = preset.weekdayColors[1] || '#000000';
                    document.getElementById('calendar-color-tuesday').value = preset.weekdayColors[2] || '#000000';
                    document.getElementById('calendar-color-wednesday').value = preset.weekdayColors[3] || '#000000';
                    document.getElementById('calendar-color-thursday').value = preset.weekdayColors[4] || '#000000';
                    document.getElementById('calendar-color-friday').value = preset.weekdayColors[5] || '#000000';
                    document.getElementById('calendar-color-saturday').value = preset.weekdayColors[6] || '#000000';
                    appendLog(`🎨 ${preset.weekdayColors.length} Farben geladen`);
                }

                appendLog(`✅ Vorlage geladen: ${preset.name}`);
            }
        } catch (error) {
            appendLog(`❌ Fehler beim Laden der Vorlage: ${formatErrorMessage(error)}`);
            console.error('loadCalendarPreset error:', error);
        }
    }

    async function saveCalendarPresetHandler() {
        try {
            const nameInput = document.getElementById('calendar-preset-name');
            const name = nameInput.value.trim();

            if (!name) {
                showMessage(t('msg.calendarPresetNameRequired') || 'Bitte Namen eingeben', true);
                appendLog('❌ Kalender-Vorlage: Name fehlt');
                return;
            }

            appendLog(`💾 Speichere Kalender-Vorlage: ${name}`);

            const preset = {
                name: name,
                year: parseInt(document.getElementById('calendar-year').value, 10),
                month: parseInt(document.getElementById('calendar-month').value, 10),
                layout: document.getElementById('calendar-layout').value,
                startDay: parseInt(document.getElementById('calendar-start-day').value, 10),
                cellWidth: parseLocalizedFloat(document.getElementById('calendar-cell-width').value),
                cellHeight: parseLocalizedFloat(document.getElementById('calendar-cell-height').value),
                showWeekNumbers: document.getElementById('calendar-show-week-numbers').checked,
                showWeekdays: document.getElementById('calendar-show-weekdays').checked,
                weekdayFormat: document.getElementById('calendar-weekday-format').value,
                fontFamily: document.getElementById('calendar-font-family').value,
                fontSize: parseLocalizedFloat(document.getElementById('calendar-font-size').value),
                weekdayColors: [
                    document.getElementById('calendar-color-sunday').value,
                    document.getElementById('calendar-color-monday').value,
                    document.getElementById('calendar-color-tuesday').value,
                    document.getElementById('calendar-color-wednesday').value,
                    document.getElementById('calendar-color-thursday').value,
                    document.getElementById('calendar-color-friday').value,
                    document.getElementById('calendar-color-saturday').value
                ]
            };

            calendarPresets.push(preset);
            await saveCalendarPresets(calendarPresets);
            nameInput.value = '';
            await renderCalendarPresets();
            appendLog(`✅ Kalender-Vorlage gespeichert: ${name}`);
            showMessage(t('msg.calendarPresetSaved') || 'Vorlage gespeichert');
        } catch (error) {
            appendLog(`❌ Fehler beim Speichern der Vorlage: ${formatErrorMessage(error)}`);
            showMessage(`Fehler: ${formatErrorMessage(error)}`, true);
        }
    }

    async function deleteCalendarPreset(index) {
        try {
            if (index >= 0 && index < calendarPresets.length) {
                const name = calendarPresets[index].name;
                appendLog(`🗑️ Lösche Kalender-Vorlage: ${name}`);
                calendarPresets.splice(index, 1);
                await saveCalendarPresets(calendarPresets);
                await renderCalendarPresets();
                appendLog(`✅ Vorlage gelöscht: ${name}`);
                showMessage(t('msg.calendarPresetDeleted') || 'Vorlage gelöscht');
            }
        } catch (error) {
            appendLog(`❌ Fehler beim Löschen: ${formatErrorMessage(error)}`);
            showMessage(`Fehler: ${formatErrorMessage(error)}`, true);
        }
    }

    async function createCalendar() {
        try {
            appendLog('--- Kalendererstellung gestartet ---');

            const doc = getActiveDocumentSafe();

            if (!doc) {
                showMessage('Kein aktives Dokument', true);
                appendLog('❌ Abbruch: Kein aktives Dokument');
                return;
            }

            // Check if document has pages
            appendLog(`📄 Dokument hat ${doc.pages ? doc.pages.length : 0} Seite(n)`);

            if (!doc.pages || doc.pages.length === 0) {
                showMessage('Dokument hat keine Seiten', true);
                appendLog('❌ Abbruch: Dokument hat keine Seiten');
                return;
            }

            // Get calendar parameters
            const year = parseInt(document.getElementById('calendar-year').value, 10);
            const month = parseInt(document.getElementById('calendar-month').value, 10);
            const layout = document.getElementById('calendar-layout').value;
            const startDay = parseInt(document.getElementById('calendar-start-day').value, 10);
            let cellWidth = roundToMax3Decimals(parseLocalizedFloat(document.getElementById('calendar-cell-width').value)) || 50;
            let cellHeight = roundToMax3Decimals(parseLocalizedFloat(document.getElementById('calendar-cell-height').value)) || 40;
            const showWeekNumbers = document.getElementById('calendar-show-week-numbers').checked;
            const showWeekdaysEl = document.getElementById('calendar-show-weekdays');
            const showWeekdays = showWeekdaysEl ? showWeekdaysEl.checked : true;
            const weekdayFormatEl = document.getElementById('calendar-weekday-format');
            const weekdayFormat = weekdayFormatEl ? weekdayFormatEl.value : 'medium';

            // Get font and color settings
            const fontFamily = document.getElementById('calendar-font-family').value || 'Arial';
            const fontSize = roundToMax3Decimals(parseLocalizedFloat(document.getElementById('calendar-font-size').value)) || 10;

            // Get weekday colors
            const weekdayColors = [
                document.getElementById('calendar-color-sunday').value || '#000000',
                document.getElementById('calendar-color-monday').value || '#000000',
                document.getElementById('calendar-color-tuesday').value || '#000000',
                document.getElementById('calendar-color-wednesday').value || '#000000',
                document.getElementById('calendar-color-thursday').value || '#000000',
                document.getElementById('calendar-color-friday').value || '#000000',
                document.getElementById('calendar-color-saturday').value || '#000000'
            ];

            appendLog(`📅 Erstelle Kalender: ${month}/${year}, Layout: ${layout}`);
            appendLog(`🔤 Optionen: Wochentage=${showWeekdays}, Wochen-Nr=${showWeekNumbers}, Format=${weekdayFormat}`);
            appendLog(`✏️ Schrift: ${fontFamily} ${fontSize}pt`);
            appendLog(`🎨 Farben: ${weekdayColors.filter(c => c !== '#000000').length} individuelle`);

            // Get first page - try multiple methods
            let page = null;

            // Method 1: Direct array access
            if (doc.pages.length > 0) {
                page = doc.pages.item(0);
            }

            // Method 2: Iterate
            if (!page && doc.pages.length > 0) {
                for (let i = 0; i < doc.pages.length; i++) {
                    page = doc.pages[i];
                    if (page) break;
                }
            }

            if (!page) {
                showMessage('Konnte keine Seite im Dokument finden', true);
                appendLog(`❌ Page ist null/undefined, doc.pages.length=${doc.pages.length}`);
                return;
            }

            appendLog(`Seite gefunden: ${page.name || 'unbenannt'}`);

            const bounds = page.bounds;
            if (!bounds || bounds.length < 4) {
                showMessage('Konnte Seitengrenzen nicht lesen', true);
                appendLog(`❌ Bounds ungültig: ${JSON.stringify(bounds)}`);
                return;
            }

            // Calculate page dimensions [top, left, bottom, right]
            const pageWidth = Math.abs(bounds[3] - bounds[1]);
            const pageHeight = Math.abs(bounds[2] - bounds[0]);
            const pageTop = bounds[0];
            const pageLeft = bounds[1];

            appendLog(`Seite: ${pageWidth.toFixed(3)}×${pageHeight.toFixed(3)}mm`);

            // Weekday names in different formats
            const getWeekdaysArray = (format, startDayValue) => {
                let baseArray;
                switch (format) {
                    case 'short':
                        baseArray = ['S', 'M', 'D', 'M', 'D', 'F', 'S'];
                        break;
                    case 'long':
                        baseArray = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
                        break;
                    case 'medium':
                    default:
                        baseArray = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
                        break;
                }

                // If Monday start, rotate array
                if (startDayValue === 1) {
                    return [...baseArray.slice(1), baseArray[0]]; // Move Sunday to end
                }
                return baseArray;
            };

            const weekdays = getWeekdaysArray(weekdayFormat, startDay);

            // Calculate days in month
            const date = new Date(year, month - 1, 1);
            const daysInMonth = new Date(year, month, 0).getDate();
            const firstDay = date.getDay(); // 0=Sunday, 6=Saturday

            // Determine layout configuration
            let cols, rows, adjustedFirstDay = 0;

            switch (layout) {
                case 'single-row':
                    cols = daysInMonth;
                    rows = 1;
                    if (showWeekdays) {
                        rows = 2; // Add extra row for weekday headers
                    }
                    cellWidth = Math.min(cellWidth, pageWidth / (cols + 0.5)); // Auto-fit to page width
                    appendLog(`Single-Row: ${cols} Zellen${showWeekdays ? ' + Wochentags-Zeile' : ''}, Breite: ${cellWidth.toFixed(3)}mm`);
                    break;

                case 'single-column':
                    cols = 1;
                    rows = daysInMonth;
                    cellHeight = Math.min(cellHeight, pageHeight / (rows + 0.5)); // Auto-fit to page height
                    appendLog(`Single-Column: ${rows} Zellen, Höhe: ${cellHeight.toFixed(3)}mm`);
                    break;

                case 'two-rows':
                    cols = Math.ceil(daysInMonth / 2);
                    rows = 2;
                    cellWidth = Math.min(cellWidth, pageWidth / (cols + 0.5));
                    appendLog(`Zwei Zeilen: ${cols}×2, Breite: ${cellWidth.toFixed(3)}mm`);
                    break;

                case 'three-rows':
                    cols = Math.ceil(daysInMonth / 3);
                    rows = 3;
                    cellWidth = Math.min(cellWidth, pageWidth / (cols + 0.5));
                    appendLog(`Drei Zeilen: ${cols}×3, Breite: ${cellWidth.toFixed(3)}mm`);
                    break;

                case 'grid':
                default:
                    // Adjust first day based on week start preference
                    adjustedFirstDay = firstDay;
                    if (startDay === 1) { // Monday start
                        adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
                    }
                    cols = 7; // Always 7 columns for days of week
                    rows = Math.ceil((adjustedFirstDay + daysInMonth) / cols);
                    appendLog(`Grid-Layout: 7×${rows}, Offset: ${adjustedFirstDay}`);
                    break;
            }

            // Select weekdays array based on start day (only for grid layout)
            const headerHeight = (layout === 'grid' || (layout === 'single-row' && showWeekdays)) ? cellHeight * 0.6 : 0; // Header only for grid layout or single-row with weekdays

            // Add space for week numbers column if enabled (only for grid layout)
            const weekNumWidth = (layout === 'grid' && showWeekNumbers) ? cellWidth * 0.5 : 0;
            const calendarWidth = weekNumWidth + (cols * cellWidth);
            const calendarHeight = headerHeight + rows * cellHeight;

            // Center calendar on page
            const startX = pageLeft + (pageWidth - calendarWidth) / 2;
            const startY = pageTop + (pageHeight - calendarHeight) / 2;

            appendLog(`📐 Kalender-Grid: ${cols}×${rows} = ${daysInMonth} Tage`);
            appendLog(`📍 Position: X=${startX.toFixed(2)}mm, Y=${startY.toFixed(2)}mm`);
            appendLog(`📏 Größe: ${calendarWidth.toFixed(2)}×${calendarHeight.toFixed(2)}mm`);

            // Create weekday header row (for grid layout or single-row with showWeekdays)
            if (layout === 'grid' || (layout === 'single-row' && showWeekdays)) {
                appendLog('📋 Erstelle Wochentags-Kopfzeile...');
                const headerCols = layout === 'grid' ? 7 : daysInMonth;

                // Add "KW" header for week numbers column if enabled
                if (layout === 'grid' && showWeekNumbers) {
                    const kwFrame = page.textFrames.add();
                    kwFrame.geometricBounds = [startY, startX, startY + headerHeight, startX + weekNumWidth];
                    kwFrame.contents = 'KW';

                    // Style the KW header
                    try {
                        if (kwFrame.paragraphs && kwFrame.paragraphs.length > 0) {
                            const para = kwFrame.paragraphs[0];
                            if (para.pointSize !== undefined) para.pointSize = fontSize * 0.8;
                            // Center alignment
                            if (para.justification !== undefined) {
                                const { Justification } = require('indesign');
                                if (Justification && Justification.CENTER_ALIGN) {
                                    para.justification = Justification.CENTER_ALIGN;
                                }
                            }
                        }
                    } catch (e) {
                        console.error('KW header styling error:', e);
                    }

                    kwFrame.strokeWeight = 0.5;
                    try {
                        const blackSwatch = doc.swatches.itemByName('Black');
                        if (blackSwatch && blackSwatch.isValid) {
                            kwFrame.strokeColor = blackSwatch;
                        }
                    } catch (e) { }
                }

                for (let col = 0; col < headerCols; col++) {
                    const x = startX + weekNumWidth + col * cellWidth;
                    const y = startY;

                    const headerFrame = page.textFrames.add();
                    headerFrame.geometricBounds = [y, x, y + headerHeight, x + cellWidth];

                    // For grid layout, use the standard weekdays
                    if (layout === 'grid') {
                        headerFrame.contents = weekdays[col];
                    } else {
                        // For single-row, show the weekday for the corresponding day
                        const dayDate = new Date(year, month - 1, col + 1);
                        let dayOfWeek = dayDate.getDay();
                        if (startDay === 1) {
                            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                        }
                        headerFrame.contents = weekdays[dayOfWeek];
                    }

                    // Apply font and styling to header
                    try {
                        if (headerFrame.paragraphs && headerFrame.paragraphs.length > 0) {
                            const para = headerFrame.paragraphs[0];

                            // Set font size (slightly smaller for header)
                            if (para.pointSize !== undefined) {
                                para.pointSize = fontSize * 0.9;
                            }

                            // Apply font family
                            try {
                                const fontObj = doc.fonts.itemByName(fontFamily);
                                if (fontObj && fontObj.isValid && para.appliedFont !== undefined) {
                                    para.appliedFont = fontObj;
                                }
                            } catch (e) { }

                            // Center alignment
                            if (para.justification !== undefined) {
                                const { Justification } = require('indesign');
                                if (Justification && Justification.CENTER_ALIGN) {
                                    para.justification = Justification.CENTER_ALIGN;
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Header formatting error:', e);
                    }

                    // Add border
                    headerFrame.strokeWeight = 0.5;
                    try {
                        const blackSwatch = doc.swatches.itemByName('Black');
                        if (blackSwatch && blackSwatch.isValid) {
                            headerFrame.strokeColor = blackSwatch;
                        }
                    } catch (e) { }
                }
            }

            // Create frames for each day (offset by header height)
            let day = 1;
            let createdFrames = 0;
            let currentWeekNumber = null;

            // Helper: Get ISO week number
            const getWeekNumber = (date) => {
                const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                const dayNum = d.getUTCDay() || 7;
                d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            };

            // For single-row layout, we only create one row of days
            const dataRows = layout === 'single-row' ? 1 : rows;

            for (let row = 0; row < dataRows; row++) {
                // Add week number cell if enabled (only for grid layout)
                if (layout === 'grid' && showWeekNumbers) {
                    // Calculate week number for first day of this row
                    let firstDayOfRow = day;
                    if (row === 0) {
                        // First row might be offset
                        firstDayOfRow = 1;
                    }

                    if (firstDayOfRow <= daysInMonth) {
                        const rowDate = new Date(year, month - 1, firstDayOfRow);
                        const weekNum = getWeekNumber(rowDate);

                        if (weekNum !== currentWeekNumber) {
                            currentWeekNumber = weekNum;
                            const weekFrame = page.textFrames.add();
                            const y = startY + headerHeight + row * cellHeight;
                            weekFrame.geometricBounds = [y, startX, y + cellHeight, startX + weekNumWidth];
                            weekFrame.contents = String(weekNum);

                            // Style week number
                            try {
                                if (weekFrame.paragraphs && weekFrame.paragraphs.length > 0) {
                                    const para = weekFrame.paragraphs[0];
                                    if (para.pointSize !== undefined) para.pointSize = fontSize * 0.8;

                                    // Apply font
                                    try {
                                        const fontObj = doc.fonts.itemByName(fontFamily);
                                        if (fontObj && fontObj.isValid && para.appliedFont !== undefined) {
                                            para.appliedFont = fontObj;
                                        }
                                    } catch (e) { }

                                    // Center alignment
                                    if (para.justification !== undefined) {
                                        const { Justification } = require('indesign');
                                        if (Justification && Justification.CENTER_ALIGN) {
                                            para.justification = Justification.CENTER_ALIGN;
                                        }
                                    }
                                }
                            } catch (e) { }

                            weekFrame.strokeWeight = 0.5;
                            try {
                                const blackSwatch = doc.swatches.itemByName('Black');
                                if (blackSwatch && blackSwatch.isValid) {
                                    weekFrame.strokeColor = blackSwatch;
                                }
                            } catch (e) { }
                        }
                    }
                }
                for (let col = 0; col < cols; col++) {
                    // Skip cells before first day (only for grid layout)
                    if (layout === 'grid' && row === 0 && col < adjustedFirstDay) continue;
                    // Stop after last day
                    if (day > daysInMonth) break;

                    const x = startX + weekNumWidth + col * cellWidth;
                    const y = startY + headerHeight + row * cellHeight;

                    // Create text frame with proper bounds [top, left, bottom, right]
                    const frame = page.textFrames.add();
                    frame.geometricBounds = [y, x, y + cellHeight, x + cellWidth];

                    // Add day number (formatting in InDesign UXP is limited, keep it simple)
                    frame.contents = String(day);

                    // Get the day of week for color application
                    const dayDate = new Date(year, month - 1, day);
                    let dayOfWeek = dayDate.getDay(); // 0=Sunday, 6=Saturday
                    if (startDay === 1) { // Monday start
                        dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    }

                    // Apply font and color
                    try {
                        if (frame.paragraphs && frame.paragraphs.length > 0) {
                            const para = frame.paragraphs[0];

                            // Set font size using correct InDesign UXP API
                            if (para.pointSize !== undefined) {
                                para.pointSize = fontSize;
                            }

                            // Apply font family using correct API
                            try {
                                const fontObj = doc.fonts.itemByName(fontFamily);
                                if (fontObj && fontObj.isValid) {
                                    if (para.appliedFont !== undefined) {
                                        para.appliedFont = fontObj;
                                    }
                                }
                            } catch (e) {
                                console.error('Font application error:', e);
                            }

                            // Center alignment for day number
                            try {
                                if (para.justification !== undefined) {
                                    const { Justification } = require('indesign');
                                    if (Justification && Justification.CENTER_ALIGN) {
                                        para.justification = Justification.CENTER_ALIGN;
                                    }
                                }
                            } catch (e) { }

                            // Apply weekday color using correct InDesign Color API
                            try {
                                const hexColor = weekdayColors[dayOfWeek];
                                if (hexColor && hexColor !== '#000000') {
                                    // Convert hex to RGB components (0-255 scale)
                                    const r = parseInt(hexColor.substr(1, 2), 16);
                                    const g = parseInt(hexColor.substr(3, 2), 16);
                                    const b = parseInt(hexColor.substr(5, 2), 16);

                                    // Try to find or create color swatch
                                    let colorSwatch = null;
                                    const swatchName = `Calendar-Day${dayOfWeek}`;

                                    try {
                                        // Try to find existing swatch
                                        colorSwatch = doc.colors.itemByName(swatchName);
                                        if (!colorSwatch || !colorSwatch.isValid) {
                                            throw new Error('Swatch not found');
                                        }
                                    } catch (e) {
                                        // Create new color swatch using correct InDesign API
                                        try {
                                            colorSwatch = doc.colors.add();
                                            colorSwatch.name = swatchName;
                                            colorSwatch.model = ColorModel.PROCESS;
                                            colorSwatch.space = ColorSpace.RGB;
                                            // RGB values in InDesign are 0-255
                                            colorSwatch.colorValue = [r, g, b];
                                            appendLog(`🎨 Swatch erstellt: ${swatchName} (RGB: ${r},${g},${b})`);
                                        } catch (e2) {
                                            console.error('Swatch creation failed:', e2);
                                        }
                                    }

                                    // Apply color to text using fillColor property
                                    if (colorSwatch && colorSwatch.isValid) {
                                        if (para.fillColor !== undefined) {
                                            para.fillColor = colorSwatch;
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error('Color application error:', e);
                            }
                        }
                    } catch (e) {
                        console.error('Paragraph access error:', e);
                    }

                    // Add border
                    frame.strokeWeight = 0.5;
                    try {
                        const blackSwatch = doc.swatches.itemByName('Black');
                        if (blackSwatch && blackSwatch.isValid) {
                            frame.strokeColor = blackSwatch;
                        }
                    } catch (e) {
                        // Black swatch not found - skip stroke color
                    }

                    createdFrames++;
                    day++;

                    // Log progress every 7 days
                    if (day % 7 === 0) {
                        appendLog(`✓ ${day - 1} Tage erstellt...`);
                    }
                }
            }

            appendLog(`✅ Kalender fertig: ${createdFrames} Zellen erstellt (${month}/${year})`);
            appendLog('--- Kalendererstellung abgeschlossen ---');
            showMessage(`Kalender erstellt: ${createdFrames} Tage für ${month}/${year}`);

        } catch (error) {
            showMessage(`Fehler beim Erstellen des Kalenders: ${formatErrorMessage(error)}`, true);
            appendLog(`❌ Kalender-Fehler: ${formatErrorMessage(error)}`);
            console.error('Calendar creation error:', error);
        }
    }

    return {
        createCalendar,
        renderCalendarPresets,
        saveCalendarPresetHandler,
        loadCalendarPreset,
        deleteCalendarPreset
    };
}

module.exports = {
    createCalendarFeature
};
