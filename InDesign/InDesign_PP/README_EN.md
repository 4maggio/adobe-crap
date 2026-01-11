# InDesign Page & Frame Tools (UXP Panel)

A UXP panel for Adobe InDesign to quickly resize, distribute, and generate layouts for frames/objects on a page or within a selection.

## Tabs (UI)

- 📐 **Size**: fixed target size + templates
- ↔ **Distribute**: positions only (no scaling)
- ⧉ **Layout**: Distribute & Scale (Single or Multi formats, Grid/Masonry)
- 🛠 **Tools**: frame/content helpers
- ⚙ **Prefs**: language, UI sizing, log/popups

## Features & Usage

Note: Most actions have a **Live Preview** checkbox directly above their button. When enabled, changing relevant inputs auto-runs the action (without popups) and reverts when you disable it or switch tabs.

### 1) 📐 Size (Resize)

- Enter target size in **mm** (width/height)
- 🔗 **Lock proportions**: when enabled, width *or* height is enough
- **Scale target**: frame, content, or both
- Save/delete reusable **templates**

Steps:
1. Select objects in InDesign
2. Set width/height (or pick a template)
3. Choose what to scale
4. Click **Apply**

### 2) ↔ Distribute (no scaling)

- Even distribution with a defined spacing
- Area: **Full page** or **Within selection (bounding box)**
- Method: **Auto** (optimized) or **Grid** (manual rows/cols)

Steps:
1. Select objects
2. Choose direction + spacing + area
3. Click **Distribute**

### 3) ⧉ Layout (Distribute & Scale)

#### Single mode (classic)

- Spacing + area
- **Scale target**: frame, content, or both
- Scale mode (fit/fill/stretch)
- **Size constraints**: min/max width/height
- **Preserve aspect ratio**: uniform scaling to keep original proportions

#### Multi mode (multiple formats)

- **Format list** (width/height in mm) with **min/max occurrences** per format
- **Allow empty frames**: creates additional empty slots if the sum of minimums exceeds the selection
- **Auto scale formats to fit**: scales all multi formats down proportionally so the largest format fits the target area
- Layout style:
  - **Grid**
  - **Masonry (columns)** with settings:
    - **Preset** (Auto / fixed columns / Manual)
    - **Columns** (for “Manual”)
    - **Frame count**: “Frames = selection” or manual (creates extra empty frames)
    - **Uniform column width**: scales all frames to a shared column width (height proportional)
    - **Seed** (deterministic shuffle)
    - **Fill page** (optionally creates extra empty frames)

Important in Multi mode:
- **“Frame” must be enabled**, otherwise format sizes can’t be applied (the UI shows an inline hint).

Layout extras:
- **“Elements overlap”**: forces spacing to 0 and disables the spacing input (no gaps).

### 4) 🛠 Tools

- **Center content**: centers graphics within selected frames
- **Fit to frame**: fits content to frame (depending on the selected mode)

### 5) ⚙ Prefs

- Language (DE/EN)
- UI parameters: **Font size**, gap, padding, divider margin
- Toggles: **Show log panel**, **Show popups**
- Log actions: **Copy log**, **Clear log**

## Persistence (storage)

Data is stored in the plugin’s data folder via the UXP File System API:

- `templates.json` (templates)
- `settings.json` (UI settings, multi formats, masonry options, toggles, ...)

## Installation

1. Open UXP Developer Tool
2. **Add Plugin** → select `manifest.json`
3. Click **Load**

## Requirements

- Adobe InDesign 2024 or newer (e.g. 20.5.0+)
- UXP plugin support

## Technical details

### Units

- **UI/input**: mm
- **InDesign internal**: points
- Conversion: $1\,\mathrm{mm} \approx 2.834645669\,\mathrm{pt}$

### Bounds & coordinates

- InDesign uses `geometricBounds` as: `[y1, x1, y2, x2]` (Top, Left, Bottom, Right)
- Grid/Masonry placement decisions are based on these bounds.

### Persistence

- `templates.json`: size templates
- `settings.json`: UI settings, multi formats, masonry options, toggles

Note: if UXP caches UI/JS, the build stamp is shown in the **⚙ Prefs** tab.

## Best practices

- **Clean selection**: For Layout/Multi, select only the frames/items you actually want to lay out.
- **Multi formats**: Start with 1–3 formats, then tighten min/max constraints incrementally.
- **Auto scale formats to fit**: Enable when formats might be larger than the target area (prevents “can never fit”).
- **Masonry**: Start with a small column count (e.g. 2–3) and set a Seed for reproducible results.
- **Fill page**: Enable only if adding extra (empty) frames is acceptable.

## Troubleshooting

- **“No active document”**: open a document and make sure it’s active
- **“No objects selected”**: select at least one object
- **UI changes not visible**: close and re-open the panel (UXP can cache UI/JS)

## Development

### Structure

```
InDesign_PP/
├── manifest.json      # plugin manifest
├── index.html         # UI (panel)
├── main.js            # logic (InDesign API + UI wiring)
├── package.json       # build/meta
├── icons/             # icons
└── builds/            # built versions (if used)
```

## License

AGPL-3.0-or-later – see LICENSE in the repository root.
