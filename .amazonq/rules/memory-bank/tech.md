# Technology Stack

## Languages
- **JavaScript (Node.js)**: All build scripts

## Dependencies
| Library | Purpose |
|---------|---------|
| pngjs | Pure JS PNG read/write for sprite extraction and tile rendering |
| sql.js | SQLite compiled to WASM — creates .sqlitedb files without native bindings |

## Data Formats
- **Input**: APK (ZIP containing GeoJSON, sprite sheets, tiles)
- **Output**:
  - `.sqlitedb` — OsmAnd raster tile overlay (BigPlanet format: z = 17 - zoom)
  - `.gpx` — OsmAnd favorites with `<osmand:icon>` extensions

## OsmAnd Tile Format (sqlitedb)
- Table `tiles (x int, y int, z int, s int, image blob, PRIMARY KEY (x,y,z,s))`
- Table `info (maxzoom Int, minzoom Int)`
- z stored as `17 - zoom_level`
- x, y are standard XYZ (Slippy) tile coordinates
- Images are PNG with transparency (colorType 6)
- Placed in `Android/data/net.osmand.plus/files/tiles/`

## OsmAnd Favorites GPX Format
- Creator must be `OsmAnd`
- Namespace `xmlns:osmand="https://osmand.net"`
- Extensions: `<osmand:icon>`, `<osmand:color>`, `<osmand:background>`
- `<type>` tag = favorites group/category name
- Icon names without `mx_` prefix (e.g. `fuel`, `parking`, `restaurant`)

## Rendering Pipeline
1. Extract APK assets (ZIP parsing with zlib)
2. Load sprite sheet (@1x) + atlas JSON
3. Lanczos-3 downsample icons to half size (20×20px)
4. For each zoom level (10–15):
   - Scanline fill polygons (even-odd rule for holes)
   - Draw lines (DDA with width)
   - Composite icons with alpha blending
5. Write tiles to SQLite via sql.js

## Map Bounds
- SW: [8.18, 46.75]
- NE: [8.75, 47.27]
- Zoom range: 10–15
