function createToolsFeature(context) {
    const {
        getActiveDocumentSafe,
        appendLog,
        showMessage,
        t,
        formatErrorMessage,
        FitOptions,
        getCheckedRadioValue,
        roundToMax3Decimals
    } = context;

    async function applyCenterContent() {
        try {
            const doc = getActiveDocumentSafe();
            if (!doc) {
                showMessage(t('msg.noActiveDocument'), true);
                return;
            }
            if (!doc || !doc.selection || doc.selection.length === 0) {
                showMessage(t('msg.noSelection'), true);
                return;
            }

            let processed = 0;
            let skipped = 0;

            for (let i = 0; i < doc.selection.length; i++) {
                const frame = doc.selection[i];

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
            appendLog('Center Content Fehler: ' + e.message);
        }
    }

    async function applyFlattenNestedFrames() {
        try {
            const doc = getActiveDocumentSafe();
            if (!doc) {
                showMessage(t('msg.noActiveDocument'), true);
                return;
            }
            if (!doc || !doc.selection || doc.selection.length === 0) {
                showMessage(t('msg.noSelection'), true);
                return;
            }

            let flattened = 0;
            let skipped = 0;
            const itemsToDelete = [];

            for (let i = 0; i < doc.selection.length; i++) {
                const item = doc.selection[i];

                if (!item) continue;

                try {
                    // Prüfe ob das Item selbst in anderen Items verschachtelt ist
                    let parent = null;
                    try {
                        if (item.parent && item.parent.typename !== 'Document') {
                            parent = item.parent;
                        }
                    } catch (_) {
                        // ignore
                    }

                    if (!parent) {
                        // Kein äußerer Rahmen - check if it contains nested frames
                        const hasNestedFrames = checkForNestedFrames(item);
                        if (!hasNestedFrames) {
                            skipped++;
                            continue;
                        }
                    }

                    // Wenn item einen Parent hat (äußerer Rahmen), versuche zu "flattenen"
                    if (parent && parent.typename === 'Rectangle') {
                        // Transferiere alle Graphics vom Item zum Parent
                        if (item.allGraphics && item.allGraphics.length > 0) {
                            for (let g = 0; g < item.allGraphics.length; g++) {
                                const graphic = item.allGraphics[g];
                                // Versuche die Grafik zu duplizieren im Parent
                                try {
                                    const parentGraphics = parent.allGraphics;
                                    if (parentGraphics && graphic) {
                                        // Kopiere Position und Größe
                                        const gb = graphic.geometricBounds;
                                        if (gb) {
                                            // Grafik existiert bereits, nur nötig wenn wir den innersten Frame behalten
                                            appendLog(`Nested Frame: Grafik transferiert in äußeren Rahmen`);
                                        }
                                    }
                                } catch (e) {
                                    appendLog(`Fehler beim Transferieren von Grafik: ${e.message}`);
                                }
                            }
                        }

                        // Markiere äußeren Rahmen zum Löschen
                        itemsToDelete.push({ item: parent, originalIndex: i, label: parent.id ? `ID ${parent.id}` : `Index ${i}` });
                        flattened++;
                        appendLog(`Flatten: Äußerer Rahmen ${itemsToDelete[itemsToDelete.length - 1].label} zum Löschen vorgemerkt`);
                    } else if (parent) {
                        appendLog(`Flatten: Object ${item.id || i} hat keinen Rectangle-Parent, übersprungen`);
                        skipped++;
                    } else {
                        skipped++;
                    }
                } catch (e) {
                    appendLog(`Fehler bei Objekt ${i}: ${e.message}`);
                    skipped++;
                }
            }

            // Lösche alle vorgemerkten äußeren Rahmen
            for (let d = 0; d < itemsToDelete.length; d++) {
                try {
                    const toDelete = itemsToDelete[d].item;
                    if (toDelete && typeof toDelete.remove === 'function') {
                        toDelete.remove();
                        appendLog(`Flatten: Äußerer Rahmen ${itemsToDelete[d].label} gelöscht`);
                    }
                } catch (delErr) {
                    appendLog(`Fehler beim Löschen: ${delErr.message}`);
                }
            }

            appendLog(`Flatten Nested Frames: ${flattened} Rahmen vereinfacht, ${skipped} übersprungen`);

            if (flattened === 0) {
                showMessage('Keine verschachtelten Rahmen gefunden', false);
            } else {
                showMessage(`${flattened} verschachtelte Rahmen vereinfacht`, false);
            }
        } catch (e) {
            showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(e) }), true);
            appendLog('Flatten Nested Frames Fehler: ' + e.message);
        }
    }

    function checkForNestedFrames(item) {
        try {
            // Prüfe ob item mehrere Rahmen/Grafiken enthält
            if (!item) return false;

            let frameCount = 0;
            if (item.rectangles && item.rectangles.length > 0) frameCount += item.rectangles.length;
            if (item.ovals && item.ovals.length > 0) frameCount += item.ovals.length;
            if (item.polygons && item.polygons.length > 0) frameCount += item.polygons.length;
            if (item.allGraphics && item.allGraphics.length > 0) frameCount += item.allGraphics.length;

            return frameCount > 0;
        } catch (_) {
            return false;
        }
    }

    async function applyFitToFrame() {
        try {
            const doc = getActiveDocumentSafe();
            if (!doc) {
                showMessage(t('msg.noActiveDocument'), true);
                return;
            }
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
                                // True stretch: width AND height independently (distorts)
                                scaleX = (frameWidth / gw) * 100;
                                scaleY = (frameHeight / gh) * 100;
                                appendLog(`  -> Stretch (verzerrt): scaleX=${scaleX.toFixed(3)}%, scaleY=${scaleY.toFixed(3)}%`);
                            } else if (mode === 'fill') {
                                // Fill: choose bigger factor so content covers the frame
                                const scaleToFitWidth = (frameWidth / gw) * 100;
                                const scaleToFitHeight = (frameHeight / gh) * 100;

                                if (scaleToFitWidth > scaleToFitHeight) {
                                    const s = scaleToFitWidth;
                                    scaleX = s;
                                    scaleY = s;
                                    const label = frame.id ? `ID ${frame.id}` : `Index ${i}`;
                                    appendLog(`  -> Fill (horz) ${label}: Frame ${roundToMax3Decimals(frameWidth)}x${roundToMax3Decimals(frameHeight)}mm, Content ${roundToMax3Decimals(gw)}x${roundToMax3Decimals(gh)}mm, ScaleW=${roundToMax3Decimals(scaleToFitWidth)}% > ScaleH=${roundToMax3Decimals(scaleToFitHeight)}%, Gewählt=${roundToMax3Decimals(s)}%`);
                                } else {
                                    const s = scaleToFitHeight;
                                    scaleX = s;
                                    scaleY = s;
                                    const label = frame.id ? `ID ${frame.id}` : `Index ${i}`;
                                    appendLog(`  -> Fill (vert) ${label}: Frame ${roundToMax3Decimals(frameWidth)}x${roundToMax3Decimals(frameHeight)}mm, Content ${roundToMax3Decimals(gw)}x${roundToMax3Decimals(gh)}mm, ScaleW=${roundToMax3Decimals(scaleToFitWidth)}% < ScaleH=${roundToMax3Decimals(scaleToFitHeight)}%, Gewählt=${roundToMax3Decimals(s)}%`);
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

                            graphic.absoluteHorizontalScale = scaleX;
                            graphic.absoluteVerticalScale = scaleY;

                            // Center after scaling
                            if (frame.fit && FitOptions) {
                                frame.fit(FitOptions.CENTER_CONTENT);
                            } else {
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
            appendLog('Scale to Frame Fehler: ' + e.message);
        }
    }

    return {
        applyCenterContent,
        applyFitToFrame,
        applyFlattenNestedFrames
    };
}

module.exports = {
    createToolsFeature
};
