/**
 * Storage Module
 * Handles plugin file system access and manifest management
 * @module storage
 */

const fs = require("uxp").storage.localFileSystem;

let pluginDataFolder = null;
let pluginFolder = null;
let cachedManifestVersion = null;

/**
 * Gets the plugin folder
 * @returns {Promise<Folder>} Plugin folder object
 */
async function getPluginFolder() {
    if (!pluginFolder) {
        pluginFolder = await fs.getPluginFolder();
    }
    return pluginFolder;
}

/**
 * Gets the manifest version from manifest.json
 * @returns {Promise<string|null>} Version string or null if not found
 */
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

/**
 * Gets the plugin data folder for persistent storage
 * @returns {Promise<Folder>} Data folder object
 */
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
