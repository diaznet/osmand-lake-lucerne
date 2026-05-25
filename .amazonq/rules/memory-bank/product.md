# Product Overview

## Purpose
Generates OsmAnd-compatible nautical overlay files for Lake Lucerne (Vierwaldstättersee), Switzerland. The project extracts map assets from the Mappuls Lake Lucerne Android app (com.mappuls.lakelucerne) and converts them into OsmAnd tile overlays and favorites.

## Value Proposition
- Provides a nautical chart overlay for Lake Lucerne on OsmAnd
- Original app icons rendered into raster tile overlay
- Shore zones (150m/300m) as semi-transparent red polygons
- Speed limits, ferry routes, cables as colored lines
- Searchable POI favorites with OsmAnd built-in icons
- Pure JavaScript — runs on any platform with Node.js (no native deps)

## Key Features
- **Raster tile overlay (.sqlitedb)**: POI icons, shore zones, nature zones, water zones, speed limits, ferry routes, cables
- **Zones-only overlay (.sqlitedb)**: Same without POI icons (for use with GPX favorites)
- **OsmAnd favorites (.gpx)**: POIs with OsmAnd built-in icons (always upright, searchable)
- **APK auto-extraction**: Extracts assets from APK on first run
- **Two overlay options**: Full (with baked icons) or zones-only (pair with favorites for upright icons)

## Target Users
- Boat owners on Lake Lucerne using OsmAnd for navigation
- Users wanting nautical chart information overlaid on OsmAnd's base map

## Use Cases
- Navigation reference for harbors, speed zones, ferry routes
- Identifying shore zone boundaries (150m/300m restricted areas)
- Finding services (fuel, parking, WC, restaurants) near the lake
