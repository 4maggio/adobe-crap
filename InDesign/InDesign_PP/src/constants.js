/**
 * Constants Module
 * Centralized configuration constants for the plugin
 * @module constants
 */

// Size constraints (in mm)
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 9999;

// File names for persistent storage
const TEMPLATES_FILENAME = 'templates.json';
const CALENDAR_PRESETS_FILENAME = 'calendar-presets.json';

// UI constraints
const LOG_BUFFER_LIMIT = 2000;
const LIVE_PREVIEW_DEBOUNCE_MS = 500;
const DEFAULT_MASONRY_COLS = 3;
const DEFAULT_GAP = 5;
const DEFAULT_PADDING = 5;

// Localization
const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['de', 'en'];

module.exports = {
  // Size constraints
  MIN_DIMENSION,
  MAX_DIMENSION,
  
  // File names
  TEMPLATES_FILENAME,
  CALENDAR_PRESETS_FILENAME,
  
  // UI configuration
  LOG_BUFFER_LIMIT,
  LIVE_PREVIEW_DEBOUNCE_MS,
  DEFAULT_MASONRY_COLS,
  DEFAULT_GAP,
  DEFAULT_PADDING,
  
  // Localization
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES
};
