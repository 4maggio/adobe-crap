function createLivePreview(context) {
    const {
        getInDesignApp,
        getActiveDocumentSafe,
        parseLocalizedFloat,
        MIN_DIMENSION,
        getCheckedRadioValue,
        appendLog,
        getPluginSettings,
        getDefinedFormats,
        getSelectedPreset,
        applyLayoutPreset,
        applyResize,
        applyDistribute,
        applyDistributeScale,
        applyFitToFrame,
        applyCenterContent
    } = context;

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
        const allowEmptyFrames = allowEmptyFramesEl ? !!allowEmptyFramesEl.checked : !!getPluginSettings().allowEmptyFrames;

        const layoutStyleEl = document.getElementById('multi-layout-style');
        const style = layoutStyleEl ? String(layoutStyleEl.value || '') : String(getPluginSettings().multiLayoutStyle || 'grid');

        const masonryFillEl = document.getElementById('masonry-fill-page');
        const masonryFillPage = masonryFillEl ? !!masonryFillEl.checked : !!getPluginSettings().masonryFillPage;

        // These options can create additional objects; without undo this can quickly accumulate.
        return !!(allowEmptyFrames || (style === 'masonry' && masonryFillPage));
    }

    function canLivePreviewDistributeScale(state) {
        if (!hasActiveSelection()) return false;
        const overlapEl = document.getElementById('overlap-elements');
        const overlapEnabled = overlapEl ? !!overlapEl.checked : !!getPluginSettings().overlapElements;

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

            const formats = getDefinedFormats();
            if (!Array.isArray(formats) || formats.length === 0) {
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

    function canLivePreviewFitToFrame() {
        return hasActiveSelection();
    }

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
        appendLog('🔧 Initialisiere Live Preview Event-Listener...');
        let totalListeners = 0;

        const wire = (kind) => {
            const cfg = livePreviewRegistry[kind];
            const st = livePreviewState[kind];
            if (!cfg || !st) return;

            const toggle = document.getElementById(cfg.checkboxId);
            if (!toggle) {
                appendLog(`⚠️ Toggle nicht gefunden für: ${kind}`);
                return;
            }

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
            totalListeners++;
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
                    totalListeners++;
                });
            };

            (cfg.watchIds || []).forEach((id) => watchEl(document.getElementById(id)));
            (cfg.watchNames || []).forEach((name) => {
                document.querySelectorAll(`input[name="${name}"]`).forEach((el) => watchEl(el));
            });
        };

        Object.keys(livePreviewRegistry).forEach(wire);
        appendLog(`✅ ${totalListeners} Live Preview Event-Listener registriert`);
    }

    return {
        supportsUndo,
        tryUndoOnce,
        revertAllLivePreviews,
        requestLivePreview,
        applyWithLivePreviewCommit,
        initLivePreviewWiring,
        livePreviewDistributeScaleRequiresUndo
    };
}

module.exports = {
    createLivePreview
};
