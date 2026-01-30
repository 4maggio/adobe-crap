## 📅 Neue Features

### 1. Kalender-Tab
- Automatische Erstellung von Wandkalendern mit verschiedenen Layouts
- **5 Layout-Presets**:
  - Klassisches Grid (7×N) mit Wochentags-Header (M D M D F S S)
  - Eine Zeile (horizontal, Auto-Anpassung an Seitenbreite)
  - Eine Spalte (vertikal, Auto-Anpassung an Seitenhöhe)
  - Zwei/Drei Zeilen (gleichmäßige Verteilung)
- Wochenstart-Auswahl (Montag/Sonntag)
- Automatische Zentrierung auf Seite
- Konfigurierbare Zellgrößen

### 2. Layout-Presets Tab
- 9 vordefinierte Foto-Layouts:
  - **Hero Center**: Großes Bild zentral, kleinere rundherum
  - **Hero Stack**: 3 Bilder vertikal gestapelt
  - **Masonry 2/3 Spalten**: Variable Höhen
  - **Grid 2×2 / 3×3**: Gleichmäßige Raster
  - **L-Layout**: Großes Bild links, Galerie rechts
  - **Magazin-Stil**: Asymmetrisch, dynamisch
  - **Collage**: Freie Anordnung
- Live-Vorschau für alle Presets
- Übertragung in Layout-Tab möglich
- SVG-Vorschauen für visuelle Auswahl

### 3. Live-Vorschau System
- Checkbox für temporäre Anwendung in allen Tabs
- Debounced Updates (300-550ms je nach Komplexität)
- Automatisches Zurücksetzen beim Tab-Wechsel
- Snapshot/Restore-System für revertierbares Arbeiten

### 4. Masonry-Layout Verbesserungen
- **Spalten-Presets**: Auto, 1-5 Spalten, Manuell
- **Rahmenanzahl-Modi**: Auswahl = Rahmen oder manuelle Anzahl
- **Seeded Shuffle**: Reproduzierbare Zufallsanordnung
- Seite auffüllen-Option
- Einheitliche Spaltenbreite-Toggle

### 5. Multi-Format Verbesserungen
- **Leere Rahmen erlauben**: Erstellt zusätzliche Slots wenn min-Werte > Auswahl
- **Auto-Skalierung**: Passt alle Formate an Seite an
- **Seitenverhältnis beibehalten**: Für Single- und Multi-Modus
- **Elemente überlappen**: Setzt Abstand auf 0
- Inline-Warnung wenn Rahmen nicht aktiviert

## 🎨 UI/UX Verbesserungen

- Tab-Icons mit Emojis
- Build-Stamp zeigt Git SHA + manifest Version
- Font-Size Workarounds für UXP
- Log Auto-Scroll
- Tooltips für alle neuen Features

## 🔧 Technische Verbesserungen

- getInDesignApp() Safe wrapper
- getActiveDocumentSafe() Fallback-Chain
- Seeded RNG für reproduzierbare Layouts
- Debounce-Utility
- Live-Preview Registry-System
- 2000 Log-Einträge
- Auswahl-Tracking

## 📚 Dokumentation

- README Updates (DE/EN)
- Alle neuen Features dokumentiert
- AGPL-3.0-or-later Lizenz
- package.json aktualisiert

## 🐛 Bugfixes

- Masonry Preset-Größen korrigiert
- Multi-Format Überlappungen behoben
- Empty-Frame-Creation nur wenn erlaubt
- Cell-based Positionierung

## 🔢 Version

**v1.0.2 → v1.0.3**

## ✅ Testing

- Kalender-Erstellung getestet (alle 5 Layouts)
- Layout-Presets getestet (alle 9 Varianten)
- Live-Vorschau in allen Tabs getestet
- InDesign 2024+ kompatibel
