# Development Guidelines

This document outlines best practices and guidelines for developing the InDesign Page & Frame Tools plugin.

## Code Organization

### Modular Architecture

The plugin uses a feature-based modular architecture:

1. **Features** are self-contained units (`src/features/*.js`)
2. **Utilities** provide shared functions (`src/utils.js`, `src/storage.js`, etc.)
3. **main.js** orchestrates initialization and wiring

### Dependency Injection

All features use dependency injection to receive their dependencies:

```javascript
const layoutFeature = createLayoutFeature({
  getActiveDocumentSafe,
  appendLog,
  showMessage,
  t,
  // ... other dependencies
});
```

**Benefits:**
- Easy unit testing with mocked dependencies
- Clear visibility of dependencies
- Loose coupling between modules
- Easy to add/remove features

## Adobe UXP Best Practices

### Safe App Access

Always use safe access patterns for InDesign app:

```javascript
function getInDesignApp() {
  try {
    const mod = require('indesign');
    return mod && mod.app ? mod.app : null;
  } catch (_) {
    return null;
  }
}
```

### Error Handling

Wrap all InDesign API calls in try/catch:

```javascript
async function applyResize() {
  try {
    const doc = getActiveDocumentSafe();
    if (!doc) {
      showMessage(t('msg.noActiveDocument'), true);
      return;
    }
    // ... operation
  } catch (e) {
    appendLog('Error: ' + formatErrorMessage(e));
    showMessage(t('msg.errorWithMessage', { message: formatErrorMessage(e) }), true);
  }
}
```

### Async/Await

Use async/await for file I/O and async operations:

```javascript
async function saveSettings() {
  try {
    const folder = await getPluginDataFolder();
    const file = await folder.createFile('settings.json', { overwrite: true });
    await file.write(JSON.stringify(pluginSettings));
  } catch (e) {
    console.error('Save failed:', e);
  }
}
```

### DOM Safety

Always check element existence before accessing:

```javascript
const logEl = document.getElementById('log-output');
if (!logEl) return; // Element might not exist in this panel state

logEl.textContent = message;
```

## Testing & Debugging

### Logging

Use the centralized logger:

```javascript
appendLog('Operation started');
appendLog(`Processing ${count} items`);
appendLog('✅ Success!');
appendLog('❌ Error: ' + message);
```

### Live Preview

The live preview system allows testing changes before applying:
- Tests operations with undo capability
- Reverts if user closes panel without confirming
- Respects user's live preview toggle setting

## Code Style

### Naming Conventions

- **Functions**: camelCase, descriptive names (`applyResize`, `getActiveDocumentSafe`)
- **Constants**: UPPER_SNAKE_CASE (`MIN_DIMENSION`, `MAX_DIMENSION`)
- **Variables**: camelCase (`pluginSettings`, `definedFormats`)
- **Private functions**: Same as public, but don't export

### Comments

- Use JSDoc for all exported functions and modules
- Add inline comments for complex logic
- Use comments to explain "why", not "what"

```javascript
/**
 * Resizes a frame to the target dimensions
 * @param {Object} item - InDesign object to resize
 * @param {number} width - Target width in mm
 * @param {number} height - Target height in mm
 * @param {Object} options - Configuration options
 */
function resizeItem(item, width, height, options = {}) {
  // ...
}
```

## Adding a New Feature

1. Create `src/features/myfeature.js`
2. Implement factory function pattern:
   ```javascript
   function createMyFeature(context) {
     const { appendLog, showMessage, t, ... } = context;
     
     async function applyMyFeature() { ... }
     
     return {
       applyMyFeature
     };
   }
   ```
3. Add to `src/index.js` barrel export
4. Wire in `main.js` feature initialization
5. Add i18n strings to `src/i18n.js`
6. Add UI elements to `index.html`
7. Document in `src/README.md`

## Performance Considerations

### Debouncing
The live preview uses debouncing to avoid flooding InDesign:
```javascript
const debouncedPreview = debounce(applyResize, 500);
```

### Undo Transactions
When performing multiple operations, use undo transaction:
```javascript
// InDesign will batch these as single undo step
item.geometricBounds = [y1, x1, y2, x2];
item.fill = someColor;
```

### DOM Updates
Buffer log messages and flush together:
```javascript
logBuffer.push(message);
requestAnimationFrame(() => flushToDom());
```

## Build & Release

### Version Management

1. Update version in `package.json` and `manifest.json`
2. Build script automatically updates `BUILD_GIT_SHA` in `main.js`
3. Create build: `npm run update:build`

### Quality Checklist

- [ ] All features tested in InDesign
- [ ] Live preview tested
- [ ] Error messages are user-friendly
- [ ] Localization strings complete (DE & EN)
- [ ] No console errors or warnings
- [ ] JSDoc comments added for new code
- [ ] Code follows style guidelines
- [ ] Changelog updated (if applicable)

## Resources

- [Adobe UXP Documentation](https://github.com/AdobeXD/plugin-samples)
- [InDesign API Reference](https://github.com/AdobeXD/plugin-samples)
- [Project Manifest Reference](manifest.json)
