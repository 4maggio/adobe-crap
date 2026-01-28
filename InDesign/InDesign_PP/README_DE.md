# InDesign Page & Frame Tools (UXP Panel)

Ein UXP-Panel für Adobe InDesign zum schnellen Skalieren, Verteilen und Layouten von Rahmen/Objekten auf Seiten, sowie zum Erstellen von anpassbaren Wandkalendern. Unterstützt Deutsch und Englisch mit vollständiger Lokalisierung inklusive deutscher Dezimalnotation (Kommas).

## Tabs (UI)

- 📐 **Größe**: feste Zielgröße + Templates (unterstützt 3 Dezimalstellen)
- ↔ **Verteilen**: nur Positionen (ohne Skalierung)
- ⧉ **Layout**: Verteilen & Skalieren (Single- oder Multi-Format, Grid/Masonry)
- 🛠 **Tools**: Hilfsfunktionen für Rahmen/Inhalt, Rahmen vereinfachen
- 📅 **Kalender**: Wandkalender-Generator mit Schriften, Farben & Vorlagen
- ⚙ **Einst.**: Sprache, UI-Größen, Log/Popups

## Features & Verwendung

Hinweis: Viele Aktionen haben eine **Live-Vorschau** Checkbox direkt über dem jeweiligen Button. Wenn aktiv, wird die Aktion bei Änderungen an den Eingaben automatisch (ohne Popups) ausgeführt und beim Deaktivieren/Tab-Wechsel wieder zurückgesetzt.

### 1) 📐 Größe (Größenzuweisung)

- Zielgröße in **mm** eingeben (Breite/Höhe)
- 🔗 **Proportionen sperren**: wenn aktiv, reicht Breite *oder* Höhe
- **Was skalieren?** Rahmen, Inhalt oder beides
- **Templates** speichern/löschen und wiederverwenden

Schritte:
1. Objekte in InDesign auswählen
2. Breite/Höhe setzen (oder Template wählen)
3. Skalier-Ziel wählen
4. **Anwenden**

### 2) ↔ Verteilen (ohne Skalierung)

- Gleichmäßige Verteilung mit definiertem Abstand
- Bereich: **Gesamte Seite** oder **Innerhalb der Auswahl (Bounding Box)**
- Anordnung: **Automatisch** (optimiert) oder **Raster** (Spalten/Zeilen)

Schritte:
1. Objekte auswählen
2. Richtung + Abstand + Bereich wählen
3. **Verteilen**

### 3) ⧉ Layout (Verteilen & Skalieren)

#### Single-Modus 

- Abstand + Bereich wie oben
- **Was skalieren?** Rahmen, Inhalt oder beides
- Skalierungsmodus (z.B. anpassen/ausfüllen/strecken)
- **Größenbeschränkungen**: Min/Max Breite/Höhe
- Option **„Seitenverhältnis beibehalten“**: skaliert uniform, damit die ursprünglichen Proportionen erhalten bleiben

#### Multi-Modus (mehrere Formate)

- **Formatliste** (Breite/Höhe in mm) mit **Min/Max Vorkommen** pro Format
- **Leere Rahmen erlauben**: erzeugt zusätzliche leere Slots, wenn die Summe der Min-Werte größer als die Auswahl ist
- **Formate automatisch an Seite anpassen**: skaliert alle Multi-Formate proportional herunter, damit das größte Format überhaupt in den Bereich passt
- Layout-Stil:
  - **Raster** (klassisch)
  - **Masonry (Spalten)** mit Einstellungen:
    - **Preset** (Auto / fixe Spaltenzahl / Manuell)
    - **Spalten** (bei „Manuell“)
    - **Rahmenanzahl**: „Rahmen = Auswahl“ oder manuell (erstellt zusätzliche leere Rahmen)
    - **Einheitliche Spaltenbreite**: skaliert alle Rahmen auf eine gemeinsame Spaltenbreite (Höhe proportional)
    - **Seed** (reproduzierbare Shuffle-Reihenfolge)
    - **Seite auffüllen** (optional zusätzliche leere Rahmen)

Wichtig im Multi-Modus:
- **„Rahmen“ muss aktiviert sein**, sonst können die Formatgrößen nicht angewendet werden (UI zeigt dazu einen Hinweis).

Zusatz im Layout-Tab:
- **„Elemente überlappen“**: setzt Abstand auf 0 und deaktiviert die Abstandseingabe (keine Zwischenräume).

### 4) 🛠 Tools

- **Inhalt zentrieren**: zentriert Grafiken innerhalb ausgewählter Rahmen
- **An Rahmen anpassen**: passt Inhalt an den Rahmen an (je nach Modus)
- **Rahmen vereinfachen**: entfernt äußere Rahmen von verschachtelten Objekten

### 5) ⚙ Einst.

- Sprache (DE/EN)
- UI-Parameter: **Fontgröße**, Gap, Padding, Divider-Margin
- Toggles: **Logfenster anzeigen**, **Popups anzeigen**
- Log-Aktionen: **Log kopieren**, **Log löschen**

## Speicherung (Persistenz)

Die Daten werden im Plugin-Datenordner per UXP File System API gespeichert:

- `templates.json` (Größen-Templates)
- `settings.json` (UI-Einstellungen, Multi-Formate, Masonry-Optionen, Toggles, Sprache)
- `calendar-presets.json` (Kalender-Vorlagen mit allen Einstellungen)

## Installation

1. UXP Developer Tool öffnen
2. **Add Plugin** → `manifest.json` auswählen
3. **Load**

## Systemanforderungen

- Adobe InDesign 2024 oder neuer (z.B. 20.5.0+)
- UXP Plugin Support

## Technische Details

### Einheiten

- **Eingabe/UI**: mm
- **InDesign intern**: Punkte
- Umrechnung: $1\,\mathrm{mm} \approx 2.834645669\,\mathrm{pt}$

### Bounds & Koordinaten

- InDesign verwendet `geometricBounds` im Format: `[y1, x1, y2, x2]` (Top, Left, Bottom, Right)
- Layout-Entscheidungen (Grid/Masonry) basieren auf diesen Bounds.

### Persistenz

- `templates.json`: Größen-Templates
- `settings.json`: UI-Settings, Multi-Formate, Masonry-Optionen, Toggles, Sprache
- `calendar-presets.json`: Kalender-Vorlagen mit allen Einstellungen (Layout, Schriften, Farben)

Hinweis: Bei UI/JS-Caching in UXP hilft der Build-Stamp im Tab **⚙ Einst.**.

## Best Practices

- **Saubere Auswahl**: Für Layout/Multi am besten nur Rahmen/Objekte auswählen, die wirklich gelayoutet werden sollen.
- **Multi-Formate**: Erst 1–3 Formate definieren, dann Min/Max schrittweise verschärfen.
- **„Formate an Seite anpassen“**: Aktivieren, wenn Formate größer als der Bereich sein könnten (verhindert „passt nie“).
- **Masonry**: Spaltenzahl klein starten (z.B. 2–3), Seed setzen, damit Ergebnisse reproduzierbar sind.
- **„Seite auffüllen“**: Nur aktivieren, wenn zusätzliche (leere) Rahmen ok sind.
### 5) 📅 Kalender (Wandkalender-Generator)

#### Grundeinstellungen

- **Jahr & Monat**: Wähle Jahr (2020-2100) und Monat
- **Layout-Presets**:
  - **Klassisches Grid (7×N)**: Wochentags-Layout mit Header
  - **Eine Zeile**: Alle Tage horizontal (Auto-Anpassung an Seitenbreite)
  - **Eine Spalte**: Alle Tage vertikal (Auto-Anpassung an Seitenhöhe)
  - **Zwei Zeilen**: Gleichmäßige Verteilung auf 2 Zeilen
  - **Drei Zeilen**: Gleichmäßige Verteilung auf 3 Zeilen
- **Wochenstart**: Montag oder Sonntag (nur Grid-Layout)
- **Zellgröße**: Breite und Höhe in mm (unterstützt 3 Dezimalstellen und deutsche Dezimalschreibweise mit Komma)

#### Wochentag-Anzeigoptionen

- **Wochentage anzeigen**: Umschalter zur Anzeige von Wochentag-Kopfzeilen
- **Wochentag-Format**: Wählen zwischen
  - **Kurz**: Einzelne Buchstaben (M D M D F S S)
  - **Mittel**: 2-stellige Abkürzungen (Mo Di Mi Do Fr Sa So)
  - **Lang**: Volle Wochentagnamen (Montag, Dienstag, ...)

#### Typografie & Styling

- **Schriftart**: Wähle aus Arial, Helvetica, Times New Roman, Courier, Verdana, Georgia
- **Schriftgröße**: 6–72 pt mit Dezimal-Unterstützung
- **Wochentag-Farben**: Stelle individuelle Textfarben für jeden Wochentag ein (Sonntag–Samstag)
  - Farbwähler für jeden Wochentag
  - Farben werden automatisch beim Erstellen des Kalenders angewendet

#### Kalender-Vorlagen

- **Vorlage speichern**: Speichere alle aktuellen Einstellungen (Layout, Größe, Schriften, Farben) mit einem Namen
- **Vorlage laden**: Klicke auf eine gespeicherte Vorlage, um alle Einstellungen wiederherzustellen
- **Vorlage löschen**: Entferne unerwünschte Vorlagen
- Vorlagen werden in `calendar-presets.json` persistent gespeichert

Schritte:
1. Dokument mit mindestens einer Seite öffnen
2. Kalender-Einstellungen konfigurieren (Layout, Zellgröße, Schriften, Farben, etc.)
3. *(Optional)* Als Vorlage speichern für zukünftige Verwendung
4. **Kalender erstellen**

Das Plugin erstellt automatisch Textrahmen mit Tagesnummern, zentriert auf der Seite, mit 0,5pt schwarzen Rändern und angewendeten benutzerdefinierten Schriften/Farben.

## Troubleshooting

- **„Kein aktives Dokument“**: Dokument öffnen und sicherstellen, dass ein Dokument aktiv ist
- **„Keine Objekte ausgewählt“**: mindestens ein Objekt auswählen
- **UI-Änderungen nicht sichtbar**: Panel schließen und neu öffnen (UXP cached UI/JS manchmal)

## Entwicklung

### Struktur

```
InDesign_PP/
├── manifest.json      # Plugin-Manifest
├── index.html         # UI (Panel)
├── main.js            # Logik (InDesign API + UI wiring)
├── package.json       # Build/Meta
├── icons/             # Icons
└── builds/            # gebaute Versionen (falls genutzt)
```

## Lizenz

AGPL-3.0-or-later – siehe LICENSE im Repo-Root.
