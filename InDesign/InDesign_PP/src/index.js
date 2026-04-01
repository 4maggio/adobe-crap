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

const {
  MIN_DIMENSION,
  MAX_DIMENSION,
  TEMPLATES_FILENAME,
  CALENDAR_PRESETS_FILENAME,
  LOG_BUFFER_LIMIT,
  LIVE_PREVIEW_DEBOUNCE_MS,
  DEFAULT_MASONRY_COLS,
  DEFAULT_GAP,
  DEFAULT_PADDING,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES
} = require("./constants");

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
  
  // Constants
  MIN_DIMENSION,
  MAX_DIMENSION,
  TEMPLATES_FILENAME,
  CALENDAR_PRESETS_FILENAME,
  LOG_BUFFER_LIMIT,
  LIVE_PREVIEW_DEBOUNCE_MS,
  DEFAULT_MASONRY_COLS,
  DEFAULT_GAP,
  DEFAULT_PADDING,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  
  // Localization
  I18N,
  
  // Fonts
  getDefaultFonts,
  createFontApi
};
