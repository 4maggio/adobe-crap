function createTemplatesFeature(context) {
    const {
        appendLog,
        showMessage,
        t,
        formatErrorMessage,
        parseLocalizedFloat,
        roundToMax3Decimals,
        getPluginDataFolder,
        getRequestLivePreview
    } = context;

    const TEMPLATES_FILENAME = 'templates.json';

    async function loadTemplates() {
        try {
            const folder = await getPluginDataFolder();
            const entries = await folder.getEntries();

            let templatesFile = null;
            for (const entry of entries) {
                if (entry && entry.name === TEMPLATES_FILENAME) {
                    templatesFile = entry;
                    break;
                }
            }

            if (!templatesFile) return [];

            const contents = await templatesFile.read();
            const parsed = JSON.parse(contents);
            if (!Array.isArray(parsed)) return [];

            return parsed
                .filter(tpl => tpl && typeof tpl.name === 'string')
                .map(tpl => ({
                    name: String(tpl.name).trim(),
                    width: Number(tpl.width),
                    height: Number(tpl.height)
                }))
                .filter(tpl => tpl.name && Number.isFinite(tpl.width) && Number.isFinite(tpl.height) && tpl.width > 0 && tpl.height > 0);
        } catch (e) {
            console.error('Fehler beim Laden der Templates:', e);
            appendLog('Fehler beim Laden der Templates: ' + (e && e.message ? e.message : String(e)));
            return [];
        }
    }

    async function saveTemplates(templates) {
        try {
            if (!Array.isArray(templates)) return;

            const folder = await getPluginDataFolder();
            const templatesFile = await folder.createFile(TEMPLATES_FILENAME, { overwrite: true });
            await templatesFile.write(JSON.stringify(templates, null, 2));

            appendLog(`${templates.length} Template(s) gespeichert`);
        } catch (e) {
            console.error('Fehler beim Speichern der Templates:', e);
            appendLog('Fehler beim Speichern: ' + (e && e.message ? e.message : String(e)));
            showMessage(t('msg.templatesSaveFailed', { message: formatErrorMessage(e) }), true);
        }
    }

    async function renderTemplates() {
        const listEl = document.getElementById('template-list');
        if (!listEl) return;

        const templates = await loadTemplates();

        listEl.innerHTML = '';

        if (!templates || templates.length === 0) {
            const helperText = t && t('ui.noTemplates');
            listEl.innerHTML = `<div class="helper-text">${helperText || 'Keine Templates gespeichert'}</div>`;
            return;
        }

        templates.forEach((tpl, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'template-item';
            itemDiv.setAttribute('data-index', index.toString());

            const nameSpan = document.createElement('span');
            nameSpan.className = 'template-name';
            nameSpan.textContent = tpl.name;

            const sizeSpan = document.createElement('span');
            sizeSpan.className = 'template-size';
            sizeSpan.textContent = `${roundToMax3Decimals(tpl.width)}mm × ${roundToMax3Decimals(tpl.height)}mm`;

            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(sizeSpan);

            itemDiv.addEventListener('click', () => {
                listEl.querySelectorAll('.template-item').forEach(i => i.classList.remove('selected'));
                itemDiv.classList.add('selected');

                const widthInput = document.getElementById('resize-width');
                const heightInput = document.getElementById('resize-height');
                if (widthInput) widthInput.value = String(tpl.width);
                if (heightInput) heightInput.value = String(tpl.height);

                try {
                    const requestLivePreview = getRequestLivePreview ? getRequestLivePreview() : null;
                    if (requestLivePreview) requestLivePreview('resize');
                } catch (_) {
                    // ignore
                }
            });

            listEl.appendChild(itemDiv);
        });
    }

    function initTemplateWiring() {
        renderTemplates();

        const saveBtn = document.getElementById('save-template-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const name = document.getElementById('template-name').value.trim();
                const width = parseLocalizedFloat(document.getElementById('resize-width').value);
                const height = parseLocalizedFloat(document.getElementById('resize-height').value);

                if (!name) {
                    showMessage(t('msg.templateNameRequired'), true);
                    return;
                }

                if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
                    showMessage(t('msg.invalidFormat'), true);
                    return;
                }

                const templates = await loadTemplates();
                templates.push({ name, width, height });
                await saveTemplates(templates);
                await renderTemplates();

                const nameInput = document.getElementById('template-name');
                if (nameInput) nameInput.value = '';
                showMessage(t('msg.templateSaved'));
            });
        }

        const deleteBtn = document.getElementById('delete-template-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const selected = document.querySelector('.template-item.selected');
                if (!selected) {
                    showMessage(t('msg.templateSelectRequired'), true);
                    return;
                }

                const index = parseInt(selected.getAttribute('data-index'), 10);
                if (!Number.isFinite(index) || index < 0) {
                    showMessage(t('msg.templateSelectRequired'), true);
                    return;
                }

                const templates = await loadTemplates();
                templates.splice(index, 1);
                await saveTemplates(templates);
                await renderTemplates();

                showMessage(t('msg.templateDeleted'));
            });
        }
    }

    return {
        initTemplateWiring,
        renderTemplates,
        loadTemplates,
        saveTemplates
    };
}

module.exports = {
    createTemplatesFeature
};
