const fs = require("uxp").storage.localFileSystem;

let pluginDataFolder = null;
let pluginFolder = null;
let cachedManifestVersion = null;

async function getPluginFolder() {
    if (!pluginFolder) {
        pluginFolder = await fs.getPluginFolder();
    }
    return pluginFolder;
}

async function getManifestVersion() {
    if (cachedManifestVersion) return cachedManifestVersion;
    try {
        const folder = await getPluginFolder();
        const entry = await folder.getEntry('manifest.json');
        const text = await entry.read();
        const parsed = JSON.parse(text);
        const version = parsed && typeof parsed.version === 'string' ? parsed.version.trim() : '';
        cachedManifestVersion = version || null;
        return cachedManifestVersion;
    } catch (_) {
        cachedManifestVersion = null;
        return null;
    }
}

async function getPluginDataFolder() {
    if (!pluginDataFolder) {
        pluginDataFolder = await fs.getDataFolder();
    }
    return pluginDataFolder;
}

module.exports = {
    getPluginFolder,
    getPluginDataFolder,
    getManifestVersion
};
