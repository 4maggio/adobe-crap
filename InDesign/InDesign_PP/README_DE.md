# InDesign Page & Frame Tools

Ein UXP Plugin für Adobe InDesign zur effizienten Verwaltung und Verteilung von Objekten auf Druckbögen.

## Features

### 1. Größenzuweisung
Weisen Sie ausgewählten Objekten (z.B. Bildrahmen) präzise Größen zu:
- **Direkte Eingabe**: Geben Sie Breite und Höhe in Millimetern ein
- **Template-System**: Speichern Sie häufig verwendete Größen (z.B. "6cm x 4cm") als Templates zur Wiederverwendung
- **Flexible Skalierung**: Wählen Sie aus, ob nur der Rahmen, nur der Inhalt oder beides skaliert werden soll

**Verwendung:**
1. Wählen Sie Objekte in InDesign aus
2. Geben Sie Breite und Höhe ein oder wählen Sie ein Template
3. Wählen Sie aus, was skaliert werden soll (Rahmen/Inhalt)
4. Klicken Sie auf "Anwenden"

### 2. Verteilen ohne Skalierung
Verteilen Sie ausgewählte Elemente gleichmäßig auf dem Druckbogen:
- **Gleiche Abstände**: Alle Abstände zwischen Elementen und zu den Seitenrändern sind identisch
- **Automatische Anordnung**: Findet die optimale Raster-Anordnung
- **Manuelles Raster**: Definieren Sie selbst die Anzahl der Spalten und Zeilen
- **Richtungsauswahl**: Verteilen Sie horizontal, vertikal oder beides

**Verwendung:**
1. Wählen Sie Objekte aus
2. Wählen Sie Richtung (horizontal/vertikal)
3. Wählen Sie zwischen automatischer oder manueller Rasteranordnung
4. Klicken Sie auf "Verteilen"

### 3. Verteilen mit Skalierung
Verteilen und skalieren Sie Elemente, um die gesamte Seite optimal zu nutzen:
- **Definierte Abstände**: Legen Sie einheitliche Abstände zwischen allen Elementen fest
- **Min/Max Constraints**: Setzen Sie Mindest- und Maximalwerte für Breite und Höhe
- **Intelligente Skalierung**: Objekte werden automatisch skaliert, um die Seite zu füllen
- **Flexible Skalierungsoptionen**: Skalieren Sie Rahmen, Inhalt oder beides

**Verwendung:**
1. Wählen Sie Objekte aus
2. Geben Sie den gewünschten Abstand ein (z.B. 5mm)
3. Optional: Setzen Sie Min/Max-Werte für Breite und Höhe
4. Wählen Sie aus, was skaliert werden soll
5. Klicken Sie auf "Verteilen & Skalieren"

## Installation

1. Öffnen Sie das UXP Developer Tool
2. Laden Sie das Plugin über "Add Plugin"
3. Wählen Sie die `manifest.json` Datei aus
4. Klicken Sie auf "Load"

## Systemanforderungen

- Adobe InDesign 2024 oder neuer (Version 20.5.0+)
- UXP Plugin Support

## Technische Details

### Einheiten
- **Eingabe**: Alle Größenangaben erfolgen in Millimetern (mm)
- **Intern**: InDesign arbeitet mit Punkten (1mm = 2.834645669 Punkte)
- Das Plugin konvertiert automatisch zwischen den Einheiten

### Bounds & Koordinaten
- InDesign verwendet `geometricBounds`: `[y1, x1, y2, x2]`
- y1, x1: Obere linke Ecke
- y2, x2: Untere rechte Ecke

### Template-Speicherung
Templates werden im lokalen Storage des Browsers gespeichert und bleiben auch nach Neustart von InDesign erhalten.

## Best Practices

1. **Größenzuweisung**: 
   - Erstellen Sie Templates für häufig verwendete Größen
   - Nutzen Sie "Nur Rahmen" für leere Frames, "Beides" für Frames mit Inhalt

2. **Verteilen ohne Skalierung**:
   - Verwenden Sie die automatische Anordnung für schnelle Ergebnisse
   - Nutzen Sie das manuelle Raster für präzise Kontrolle über Layout

3. **Verteilen mit Skalierung**:
   - Setzen Sie realistische Min/Max-Werte, um extreme Skalierungen zu vermeiden
   - Testen Sie verschiedene Abstandswerte für optimale Ergebnisse

## Troubleshooting

**Problem**: "Keine Objekte ausgewählt"
- Lösung: Stellen Sie sicher, dass mindestens ein Objekt auf dem Druckbogen ausgewählt ist

**Problem**: "Kein aktives Dokument"
- Lösung: Öffnen Sie ein InDesign-Dokument

**Problem**: Templates werden nicht gespeichert
- Lösung: Prüfen Sie, ob localStorage im Browser aktiviert ist

## Entwicklung

### Struktur
```
InDesign_PP/
├── manifest.json     # Plugin-Manifest
├── index.html        # UI (Panel)
├── main.js          # Hauptlogik
├── package.json     # NPM-Konfiguration
└── icons/           # Plugin-Icons
```

### API-Verwendung
- `app.activeDocument`: Aktuelles Dokument
- `doc.selection`: Ausgewählte Objekte
- `item.geometricBounds`: Objekt-Koordinaten
- `item.allGraphics`: Grafikinhalte eines Objekts
- `graphic.horizontalScale/verticalScale`: Inhaltsskalierung

### Entry Points
Das Plugin verwendet einen Panel-Entry-Point (`mainPanel`), der die persistente UI bereitstellt.

## Lizenz

Copyright © 2025

## Support

Bei Fragen oder Problemen wenden Sie sich an den Entwickler.
