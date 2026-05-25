# OsmAnd Overlay – Lake Lucerne

Nautical overlay for Lake Lucerne (Vierwaldstättersee) for OsmAnd.

Shows POIs (harbors, fuel, slipways, ferry stops, buoys, camping…), speed limit lines, ferry routes, and the 150m/300m shore zones as red semi-transparent polygons.

## Why?

The official [Mappuls Lake Lucerne](https://www.mappuls.ch/) Android app has excellent nautical chart data, but suffers from GPS precision issues (signal loss, inaccurate heading). This project extracts the app's map data and converts it into OsmAnd-compatible overlays, giving you the same information on top of OsmAnd's superior navigation engine.

## Credits

All nautical chart data, POI information, and zone boundaries are the work of **[Mappuls AG](https://www.mappuls.ch/)**. This project merely converts their data into a different format — it does not modify, verify, or guarantee the accuracy of the content. This repository also does not puiblish the content of the app.

## APK Source

The `com.mappuls.lakelucerne.apk` file is **not included** in this repository. You must obtain it yourself (e.g. from your own device or a legitimate APK source). I am not authorized to redistribute it.

## Quick Start

1. Place `com.mappuls.lakelucerne.apk` in this directory
2. Run:
   ```
   npm install
   npm run build
   ```
3. Copy the files from `osmand-output/` to your phone
4. In OsmAnd:
   - GPX file: ☰ → My Places → Favorites → Import → select the file
   - Tile overlay: copy `.sqlitedb` to `Android/data/net.osmand.plus/files/tiles/`
     then ☰ → Configure Map → Overlay map → select "lake-lucerne-pois"

## Output Files

| File | Content |
|------|---------|
| `lake-lucerne-with-icons.sqlitedb` | Map tile overlay: POI icons + shore zones (150m/300m red), nature (green), water sport (orange), speed limits, ferry routes, cables |
| `lake-lucerne-without-icons.sqlitedb` | Same as above but without POI icons (use with GPX favorites for upright icons) |
| `lake-lucerne-favorites.gpx` | POIs + town/region labels as OsmAnd favorites with icons (always upright, searchable) |

## Requirements

- Node.js ≥ 18
- `npm install` (installs `pngjs` + `sql.js` — pure JS, no native deps)

## Updating

When a new APK version is available:

1. Replace `com.mappuls.lakelucerne.apk`
2. Delete `lake-lucerne-assets/`
3. Re-run `npm run build`
