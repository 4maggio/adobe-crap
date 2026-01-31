/**
 * Feature Modules Barrel Export
 * Centralizes all feature factory imports for cleaner main.js
 */

const { createToolsFeature } = require("./features/tools");
const { createLayoutFeature } = require("./features/layout");
const { createPresetsFeature } = require("./features/presets");
const { createTemplatesFeature } = require("./features/templates");
const { createCalendarFeature } = require("./features/calendar");
const { createLogger } = require("./logging");
const { createLivePreview } = require("./livePreview");

// Utilities
const { 
  roundToMax3Decimals, 
  parseLocalizedFloat, 
  seededShuffle, 
  xmur3, 
  mulberry32 
} = require("./utils");

const {
  getPluginFolder,
  getPluginDataFolder,
  getManifestVersion
} = require("./storage");

const { I18N } = require("./i18n");
const { getDefaultFonts, createFontApi } = require("./fonts");

module.exports = {
  // Feature factories
  createToolsFeature,
  createLayoutFeature,
  createPresetsFeature,
  createTemplatesFeature,
  createCalendarFeature,
  
  // Utilities
  createLogger,
  createLivePreview,
  roundToMax3Decimals,
  parseLocalizedFloat,
  seededShuffle,
  xmur3,
  mulberry32,
  
  // Storage
  getPluginFolder,
  getPluginDataFolder,
  getManifestVersion,
  
  // Localization
  I18N,
  
  // Fonts
  getDefaultFonts,
  createFontApi
};
