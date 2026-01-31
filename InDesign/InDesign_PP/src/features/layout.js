/**
 * Layout Feature Module
 * Provides resize and distribution functionality for InDesign objects
 * @module features/layout
 */

/**
 * Creates the layout feature with resize and distribution utilities
 * @param {Object} context - Shared context object containing dependencies
 * @returns {Object} Object with async functions: applyResize, applyDistribute, applyDistributeScale
 */
function createLayoutFeature(context) {
    const {
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
        getPluginSettings,
        getDefinedFormats,
        state
    } = context;

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

    async function applyDistributeScale() {
        try {
            const pluginSettings = getPluginSettings ? (getPluginSettings() || {}) : {};
            const definedFormats = getDefinedFormats ? (getDefinedFormats() || []) : [];

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
                    const msg = `Multi-Format: \u2211Min=${totalMin} ist gr\u00f6\u00dfer als Auswahl (${originalItemCount}). Aktiviere "Leere Rahmen erlauben" oder reduziere Min.`;
                    showMessage(msg, true);
                    appendLog(`❌ ${msg}`);
                    return;
                }

                if (allowEmptyFrames) {
                    targetCount = Math.max(originalItemCount, totalMin);
                    if (targetCount > originalItemCount) {
                        appendLog(`Leere Rahmen erlaubt: Zielanzahl Frames=${targetCount} (Auswahl=${originalItemCount}, \u2211Min=${totalMin})`);
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
                            throw new Error('Keine g\u00fcltige Verteilung m\u00f6glich (pr\u00fcfe Max-Werte: \u2211max muss \u2265 Auswahl sein oder setze Max=0 f\u00fcr unbegrenzt).');
                        }
                        cols = 1;
                        rows = distribution.length;
                        formatAssignments = distribution;
                        appendLog(`Masonry: Assignments erzeugt (${distribution.length}) (Grid-Optimierung \u00fcbersprungen)`);
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

    return {
        applyResize,
        applyDistribute,
        applyDistributeScale
    };
}

module.exports = {
    createLayoutFeature
};
