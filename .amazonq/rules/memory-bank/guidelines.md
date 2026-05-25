# Development Guidelines

## Build & Run
- `npm install` — installs pngjs + sql.js (pure JS, no native deps)
- `npm run build` — extracts APK + generates all output files
- No build tools, compilers, or platform-specific setup needed

## Code Patterns

### APK Extraction
- Parse ZIP central directory for reliable file sizes
- Use `zlib.inflateRawSync` for deflated entries
- Only extract files under `assets/` prefix

### Tile Rendering Order
1. Zone polygons (background) — 2003, 2005, 2006, 2002
2. Lines — speed limits, ferry, cables
3. POI icons (foreground) — with offset spreading

### Polygon Fill
- Even-odd rule scanline fill
- All rings (outer + holes) processed together
- Holes are automatically excluded by even-odd counting

### Icon Rendering
- Source: `lu@1x.png` sprite sheet (40×40px icons)
- Downscaled to half size (20×20px) using Lanczos-3
- Icons spanning tile edges rendered onto all affected tiles
- Offset property shifts stacked icons apart

### OsmAnd sqlitedb Format
- z = 17 - zoom (BigPlanet convention)
- x, y = XYZ tile coordinates (no TMS flip)
- info table: maxzoom = 17 - min_zoom, minzoom = 17 - max_zoom
- MBTiles NOT supported by OsmAnd (use sqlitedb)

### OsmAnd Favorites GPX
- Icon names: use names from OsmAnd's SVG icon folders (no `mx_` prefix)
- Some icons need `special_` prefix (e.g. `special_sail_boat`, `special_information`)
- `<type>` tag groups favorites into categories
- Creator must be "OsmAnd" for proper recognition

## Conventions
- Pure JavaScript, no transpilation
- No native dependencies (sql.js = WASM, pngjs = pure JS)
- Single `npm run build` produces all output
- All generated files gitignored

## Important Constraints
- OsmAnd does NOT support MBTiles — must use sqlitedb format
- OsmAnd does NOT support custom icon PNGs for favorites — limited to built-in set
- Raster tile icons rotate with map (inherent limitation)
- GPX favorites icons stay upright but limited to OsmAnd's icon set
- Borders (type 3003) excluded from rendering
