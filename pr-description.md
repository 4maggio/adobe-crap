## 📅 Neue Features in v1.0.4

### 1. Kalender-System Erweiterungen
- **Wochentags-Anzeige**: Toggle für Wochentag-Kopfzeilen
- **Wochentag-Formate**: Kurz (M D M), Mittel (Mo Di Mi), Lang (Montag...)
- **Schriftart-Auswahl**: Arial, Helvetica, Times New Roman, Courier, Verdana, Georgia
- **Schriftgröße**: 6–72pt mit Dezimal-Unterstützung
- **Pro-Wochentag Farben**: 7 individuelle Farbwähler (So–Sa)

### 2. Kalender-Presets System
- Speichern kompletter Kalender-Konfigurationen
- Automatisches Laden/Löschen von Vorlagen
- Persistierung in `calendar-presets.json`
- Alle Einstellungen werden gespeichert (Layout, Größe, Schriften, Farben)

### 3. Tools-Tab Verbesserungen
- **Flatten Frames**: Entfernt äußere Rahmen von verschachtelten Objekten
- Automatische Detektion verschachtelter Strukturen

### 4. Dezimal- & Lokalisierungsverbesserungen
- **3 Dezimalstellen** für alle Größeneingaben
- **Deutsche Dezimalnotation**: Kommas statt Punkte (z.B. 88,789 mm)
- Globale `parseLocalizedFloat()` Funktion
- Konsistente `roundToMax3Decimals()` Anwendung

### 5. Mehrsprachige UI-Aktualisierungen
- Alle neuen Labels in Deutsch und Englisch
- Automatische Übersetzung beim Sprachenwechsel
- Neue i18n-Strings: Calendar Presets, Fonts, Colors, Flatten Frames

## 🎨 UI/UX Verbesserungen

- Farbwähler Grid (2 Spalten Layout für Wochentags-Farben)
- Preset-Listen mit Click-to-Load und Delete-Buttons
- Font-Familie Dropdown
- Schriftgröße mit Dezimal-Eingabe
- Inline-Styling für bessere Lesbarkeit

## 🔧 Technische Verbesserungen

- ColorModel & ColorSpace Import für Farb-Handling
- Async Preset Load/Save mit File System API
- Wochentag-basierte Farb-Anwendung
- Font-Property-Handling für TextFrames
- Swatch-Erstellung für Custom-Farben

## 📚 Dokumentation

- README.md (v1.0.2 → v1.0.4)
- README_EN.md: Erweiterte Calendar-Sektion
- README_DE.md: Erweiterte Kalender-Sektion
- Persistence-Sektion aktualisiert
- Alle neuen Features dokumentiert

## 🐛 Bugfixes

- Font-Anwendung auf Calendar-Frames
- Farb-Swatch-Handling Fehler
- Preset-Rendering-Fehler behoben

## 🔢 Version

**v1.0.3 → v1.0.4**

## ✅ Testing

- Kalender mit verschiedenen Fonts getestet ✅
- Wochentag-Farben auf alle Tage angewendet ✅
- Presets speichern/laden funktioniert ✅
- Deutsche Dezimalnotation funktioniert ✅
- Flatten Frames Tool getestet ✅
- All-In-One Feature Set Integration ✅

## 📝 Commits

- feat: Add weekday display options to calendar
- feat: Add calendar presets, fonts, and per-weekday text colors  
- docs: Update README files for v1.0.4
