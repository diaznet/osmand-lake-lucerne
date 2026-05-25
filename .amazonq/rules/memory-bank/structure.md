# Project Structure

## Root Layout
```
osmand-overlay-lake-lucerne/
├── convert-to-osmand.js        # Extracts APK + generates favorites GPX
├── generate-tile-overlay.js    # Renders tile overlays (zones + icons + lines)
├── package.json                # npm scripts + deps (pngjs, sql.js)
├── com.mappuls.lakelucerne.apk # Source APK (gitignored)
├── .gitignore
└── README.md
```

## Generated (gitignored)
```
lake-lucerne-assets/            # Extracted from APK on first run
├── points.json                 # POI GeoJSON
├── labels.json                 # Town/region names
├── lines.json                  # Routes/boundaries MultiLineString
├── polygons.json               # Zone MultiPolygon
├── sprites/lu@1x.{json,png}   # Icon sprite sheet
└── ...

osmand-output/                  # Final output for OsmAnd
├── lake-lucerne-pois.sqlitedb  # Full overlay (zones + lines + icons)
├── lake-lucerne-zones.sqlitedb # Zones + lines only (no icons)
└── lake-lucerne-favorites.gpx  # POIs as OsmAnd favorites
```

## Build Pipeline
```
npm run build
  → node convert-to-osmand.js   (APK extract + GPX)
  → node generate-tile-overlay.js (2x sqlitedb files)
```

## GeoJSON Type Codes
- **Points**: 1001–1042 (harbors, fuel, buoys, ferry stops, landmarks, etc.)
- **Lines**: 3001 (speed), 3002 (ferry), 3004 (cable) — 3003 (border) excluded
- **Polygons**: 2002 (150m shore), 2003 (300m shore), 2005 (water), 2006 (nature)
- **Labels**: 4001 (towns), 4002 (regions)

## Icon Offset System
POIs at same location use `offset` property (0–19) to spread icons apart.
Each offset maps to [dx, dy] multiplied by icon dimensions.
