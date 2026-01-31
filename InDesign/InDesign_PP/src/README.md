# Source Code Structure

This directory contains the modularized source code for the InDesign Page & Frame Tools plugin.

## Directory Layout

```
src/
├── index.js                  # Barrel export - centralized module exports
├── features/                 # Feature-specific modules
│   ├── calendar.js          # Calendar generation and management
│   ├── layout.js            # Resize and distribution functionality
│   ├── presets.js           # Layout presets management
│   ├── templates.js         # User-defined format templates
│   └── tools.js             # Frame and content manipulation tools
├── fonts.js                 # Font loading and management
├── i18n.js                  # Internationalization (German & English)
├── logging.js               # Centralized logging system
├── livePreview.js           # Live preview functionality
├── storage.js               # File system and manifest access
├── ui.js                    # UI utility functions
└── utils.js                 # General utility functions
```

## Module Overview

### Features (`features/` folder)

Each feature module exports a factory function that creates the feature with dependencies:

- **calendar.js** - Creates calendar grids with customizable formatting
- **layout.js** - Handles resizing and distribution of objects
- **presets.js** - Manages predefined layout configurations
- **templates.js** - User-defined format templates with persistence
- **tools.js** - Tools for frame flattening and content centering

### Core Modules

- **index.js** - Barrel export for clean imports across the project
- **i18n.js** - Translation strings for German (de) and English (en)
- **logging.js** - Logger factory with buffer management and DOM flushing
- **storage.js** - UXP file system abstractions for plugin data
- **livePreview.js** - Live preview manager for testing changes before apply
- **fonts.js** - Font loading from InDesign with fallbacks
- **utils.js** - Utility functions (number rounding, seeded shuffling, parsing)
- **ui.js** - UI helper functions
  
## Dependency Injection Pattern

All feature modules use dependency injection via context objects. This allows:
- Easy testing with mocked dependencies
- Loose coupling between modules
- Clear dependency visibility in function signatures

Example:
```javascript
const layoutFeature = createLayoutFeature({
  getActiveDocumentSafe,
  appendLog,
  showMessage,
  t,
  // ... other dependencies
});
```

## Adobe UXP Compliance

The code follows Adobe UXP plugin best practices:
- Proper error handling with try/catch blocks
- Safe app access with fallback patterns
- Async/await for I/O operations
- Safe DOM access with existence checks
- Proper cleanup on panel hide

## Documentation

All functions include JSDoc comments with:
- `@param` descriptions
- `@returns` documentation
- Module descriptions
- Usage examples where applicable

For IDE support, JSDoc enables IntelliSense and type hints in VS Code.
