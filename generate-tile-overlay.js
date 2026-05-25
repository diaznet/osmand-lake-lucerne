/**
 * Generates an OsmAnd sqlitedb raster overlay with:
 * - Filled semi-transparent polygon zones (shore 150m/300m, nature, water)
 * - POI icons from the sprite sheet
 *
 * Usage: node generate-tile-overlay.js
 * Run after convert-to-osmand.js (needs lake-lucerne-assets/)
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const initSqlJs = require('sql.js');

const assetsDir = path.join(__dirname, 'lake-lucerne-assets');
const outDir = path.join(__dirname, 'osmand-output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const TILE_SIZE = 256;
const MIN_ZOOM = 10;
const MAX_ZOOM = 15;

// Zone fill colors: [R, G, B, A] (matching original app style.json)
const ZONE_COLORS = {
  2002: [255, 96, 96, 153],   // Shore 150m - red 0.6
  2003: [255, 96, 96, 102],   // Shore 300m - red 0.4
  2005: [255, 168, 0, 102],   // Water zone - orange 0.4
  2006: [50, 210, 0, 102],    // Nature zone - green 0.4
};

// --- Load assets ---
console.log('Loading assets...');
const atlas = JSON.parse(fs.readFileSync(path.join(assetsDir, 'sprites', 'lu@1x.json'), 'utf8'));
const spritePng = PNG.sync.read(fs.readFileSync(path.join(assetsDir, 'sprites', 'lu@1x.png')));
const points = JSON.parse(fs.readFileSync(path.join(assetsDir, 'points.json'), 'utf8'));
const polygons = JSON.parse(fs.readFileSync(path.join(assetsDir, 'polygons.json'), 'utf8'));
const lines = JSON.parse(fs.readFileSync(path.join(assetsDir, 'lines.json'), 'utf8'));

const zoneFeatures = polygons.features.filter(f => ZONE_COLORS[f.properties.type]);

// Line styles: [R, G, B, A, width] (matching original app)
const LINE_STYLES = {
  3001: [255, 0, 0, 255, 2],         // Speed limit - red
  3002: [119, 176, 187, 255, 1.5],   // Ferry route - teal
  3004: [253, 255, 0, 255, 1.5],     // Cable - yellow
};
const lineFeatures = lines.features.filter(f => LINE_STYLES[f.properties.type]);

console.log(`${points.features.length} POIs, ${zoneFeatures.length} zone polygons, ${lineFeatures.length} lines loaded.`);

// --- Geo/tile math ---
function lonToPixelX(lon, z) {
  return (lon + 180) / 360 * (1 << z) * TILE_SIZE;
}
function latToPixelY(lat, z) {
  const r = Math.PI / 180 * lat;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z) * TILE_SIZE;
}

// --- Scanline polygon fill with holes (even-odd rule) ---
function fillPolygonWithHoles(tile, rings, color, tileOriginX, tileOriginY) {
  const [cr, cg, cb, ca] = color;
  const sa = ca / 255;

  // Convert all rings to pixel coords relative to tile
  const allRings = rings.map(ring => ring.map(([lon, lat]) => ({
    x: lonToPixelX(lon, currentZoom) - tileOriginX,
    y: latToPixelY(lat, currentZoom) - tileOriginY
  })));

  // Find y bounds across all rings
  let yMin = TILE_SIZE, yMax = 0;
  for (const pts of allRings) {
    for (const p of pts) {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  }
  yMin = Math.max(0, Math.floor(yMin));
  yMax = Math.min(TILE_SIZE - 1, Math.floor(yMax));

  // Scanline fill using even-odd rule across all rings
  for (let y = yMin; y <= yMax; y++) {
    const intersections = [];
    for (const pts of allRings) {
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const yi = pts[i].y, yj = pts[j].y;
        if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
          const x = pts[i].x + (y - yi) / (yj - yi) * (pts[j].x - pts[i].x);
          intersections.push(x);
        }
      }
    }
    intersections.sort((a, b) => a - b);

    for (let k = 0; k < intersections.length - 1; k += 2) {
      const xStart = Math.max(0, Math.ceil(intersections[k]));
      const xEnd = Math.min(TILE_SIZE - 1, Math.floor(intersections[k + 1]));
      for (let x = xStart; x <= xEnd; x++) {
        const di = (y * TILE_SIZE + x) * 4;
        const da = tile.data[di + 3] / 255;
        const oa = sa + da * (1 - sa);
        if (oa === 0) continue;
        tile.data[di] = (cr * sa + tile.data[di] * da * (1 - sa)) / oa;
        tile.data[di + 1] = (cg * sa + tile.data[di + 1] * da * (1 - sa)) / oa;
        tile.data[di + 2] = (cb * sa + tile.data[di + 2] * da * (1 - sa)) / oa;
        tile.data[di + 3] = oa * 255;
      }
    }
  }
}

// --- Draw line segment onto tile (Bresenham with width) ---
function drawLine(tile, x0, y0, x1, y1, color, width) {
  const [cr, cg, cb, ca] = color;
  const sa = ca / 255;
  const hw = width / 2;

  // Use DDA for the main line, then fill perpendicular pixels for width
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;
  const nx = -dy / len, ny = dx / len; // normal
  const steps = Math.ceil(len);

  for (let s = 0; s <= steps; s++) {
    const cx = x0 + dx * s / steps;
    const cy = y0 + dy * s / steps;
    // Fill across the width
    const wSteps = Math.ceil(width);
    for (let w = -wSteps; w <= wSteps; w++) {
      const px = Math.round(cx + nx * w * 0.5);
      const py = Math.round(cy + ny * w * 0.5);
      if (px < 0 || px >= TILE_SIZE || py < 0 || py >= TILE_SIZE) continue;
      const dist = Math.abs(w * 0.5);
      if (dist > hw) continue;
      const di = (py * TILE_SIZE + px) * 4;
      const da = tile.data[di + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa === 0) continue;
      tile.data[di] = (cr * sa + tile.data[di] * da * (1 - sa)) / oa;
      tile.data[di + 1] = (cg * sa + tile.data[di + 1] * da * (1 - sa)) / oa;
      tile.data[di + 2] = (cb * sa + tile.data[di + 2] * da * (1 - sa)) / oa;
      tile.data[di + 3] = oa * 255;
    }
  }
}

let currentZoom = 0;

// --- Lanczos-3 icon extraction ---
function lanczos3(x) {
  if (x === 0) return 1;
  if (x >= 3 || x <= -3) return 0;
  const px = Math.PI * x;
  return (Math.sin(px) / px) * (Math.sin(px / 3) / (px / 3));
}

function extractIcon(typeCode) {
  const entry = atlas[String(typeCode)];
  if (!entry) return null;
  const { x: sx, y: sy, width: sw, height: sh } = entry;
  const tw = Math.round(sw / 2);
  const th = Math.round(sh / 2);
  const icon = new PNG({ width: tw, height: th });
  for (let dy = 0; dy < th; dy++) {
    for (let dx = 0; dx < tw; dx++) {
      const srcX = dx * sw / tw + sx;
      const srcY = dy * sh / th + sy;
      let r = 0, g = 0, b = 0, a = 0, wSum = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          const px = Math.min(Math.max(Math.round(srcX) + kx, 0), spritePng.width - 1);
          const py = Math.min(Math.max(Math.round(srcY) + ky, 0), spritePng.height - 1);
          const w = lanczos3(srcX - px) * lanczos3(srcY - py);
          const si = (py * spritePng.width + px) * 4;
          r += spritePng.data[si] * w;
          g += spritePng.data[si + 1] * w;
          b += spritePng.data[si + 2] * w;
          a += spritePng.data[si + 3] * w;
          wSum += w;
        }
      }
      const di = (dy * tw + dx) * 4;
      icon.data[di] = Math.min(255, Math.max(0, Math.round(r / wSum)));
      icon.data[di + 1] = Math.min(255, Math.max(0, Math.round(g / wSum)));
      icon.data[di + 2] = Math.min(255, Math.max(0, Math.round(b / wSum)));
      icon.data[di + 3] = Math.min(255, Math.max(0, Math.round(a / wSum)));
    }
  }
  return icon;
}

function compositeIcon(tile, icon, px, py) {
  for (let iy = 0; iy < icon.height; iy++) {
    const ty = py + iy;
    if (ty < 0 || ty >= TILE_SIZE) continue;
    for (let ix = 0; ix < icon.width; ix++) {
      const tx = px + ix;
      if (tx < 0 || tx >= TILE_SIZE) continue;
      const si = (iy * icon.width + ix) * 4;
      const di = (ty * TILE_SIZE + tx) * 4;
      const sa = icon.data[si + 3] / 255;
      if (sa === 0) continue;
      const da = tile.data[di + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa === 0) continue;
      tile.data[di] = (icon.data[si] * sa + tile.data[di] * da * (1 - sa)) / oa;
      tile.data[di + 1] = (icon.data[si + 1] * sa + tile.data[di + 1] * da * (1 - sa)) / oa;
      tile.data[di + 2] = (icon.data[si + 2] * sa + tile.data[di + 2] * da * (1 - sa)) / oa;
      tile.data[di + 3] = oa * 255;
    }
  }
}

// --- Pre-extract all icons ---
const iconCache = {};
for (const key of Object.keys(atlas)) {
  if (key === 'ban') continue;
  iconCache[key] = extractIcon(key);
}

// --- Generate tiles ---
async function generateSqliteDb(SQL, outputName, includeIcons) {
  console.log(`\nGenerating ${outputName}...`);
  const dbPath = path.join(outDir, outputName);
  const db = new SQL.Database();

  db.run(`CREATE TABLE tiles (x int, y int, z int, s int, image blob, PRIMARY KEY (x,y,z,s))`);
  db.run(`CREATE TABLE info (maxzoom Int, minzoom Int)`);
  db.run(`INSERT INTO info VALUES (${17 - MIN_ZOOM}, ${17 - MAX_ZOOM})`);
  const insertStmt = db.prepare('INSERT OR REPLACE INTO tiles (x, y, z, s, image) VALUES (?, ?, ?, 0, ?)');

  let tileCount = 0;

  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    currentZoom = z;
    const numTiles = 1 << z;
    const tileSet = new Set();

    // Find tiles touched by zone polygons
    for (const f of zoneFeatures) {
      for (const polygon of f.geometry.coordinates) {
        for (const ring of polygon) {
          for (const [lon, lat] of ring) {
            const tx = Math.floor(lonToPixelX(lon, z) / TILE_SIZE);
            const ty = Math.floor(latToPixelY(lat, z) / TILE_SIZE);
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                tileSet.add(`${tx + dx}_${ty + dy}`);
              }
            }
          }
        }
      }
    }

    // Find tiles touched by lines
    for (const f of lineFeatures) {
      for (const segment of f.geometry.coordinates) {
        for (const [lon, lat] of segment) {
          const tx = Math.floor(lonToPixelX(lon, z) / TILE_SIZE);
          const ty = Math.floor(latToPixelY(lat, z) / TILE_SIZE);
          tileSet.add(`${tx}_${ty}`);
        }
      }
    }

    // Find tiles touched by POI icons
    const poiDraws = {};
    if (includeIcons) {
      const OFFSETS = {
        0: [0, 0], 1: [-1, -1], 2: [0, -1], 3: [1, -1], 4: [2, -1],
        5: [-1, 0], 6: [1, 0], 7: [2, 0], 8: [-1, 1], 9: [0, 1],
        10: [1, 1], 11: [2, 1], 12: [-0.5, -1], 13: [0.5, -1],
        14: [-0.5, 1], 15: [0.5, 1], 16: [-0.5, -0.5], 17: [0.5, -0.5],
        18: [-0.5, 0.5], 19: [0.5, 0.5]
      };
      for (const f of points.features) {
        const [lon, lat] = f.geometry.coordinates;
        const icon = iconCache[String(f.properties.type)];
        if (!icon) continue;
        const offset = OFFSETS[f.properties.offset || 0] || [0, 0];
        const globalX = lonToPixelX(lon, z) + offset[0] * icon.width;
        const globalY = latToPixelY(lat, z) + offset[1] * icon.height;
        const left = globalX - icon.width / 2;
        const top = globalY - icon.height / 2;
        const right = left + icon.width;
        const bottom = top + icon.height;
        const txMin = Math.floor(left / TILE_SIZE);
        const txMax = Math.floor((right - 1) / TILE_SIZE);
        const tyMin = Math.floor(top / TILE_SIZE);
        const tyMax = Math.floor((bottom - 1) / TILE_SIZE);
        for (let tx = txMin; tx <= txMax; tx++) {
          for (let ty = tyMin; ty <= tyMax; ty++) {
            const key = `${tx}_${ty}`;
            tileSet.add(key);
            if (!poiDraws[key]) poiDraws[key] = [];
            poiDraws[key].push({ icon, px: Math.round(left - tx * TILE_SIZE), py: Math.round(top - ty * TILE_SIZE) });
          }
        }
      }
    }

    for (const key of tileSet) {
      const [txStr, tyStr] = key.split('_');
      const tx = parseInt(txStr), ty = parseInt(tyStr);
      if (tx < 0 || ty < 0 || tx >= numTiles || ty >= numTiles) continue;

      const tile = new PNG({ width: TILE_SIZE, height: TILE_SIZE });
      const tileOriginX = tx * TILE_SIZE;
      const tileOriginY = ty * TILE_SIZE;

      // 1. Render zone polygons
      for (const typeCode of [2003, 2005, 2006, 2002]) {
        const color = ZONE_COLORS[typeCode];
        for (const f of zoneFeatures) {
          if (f.properties.type !== typeCode) continue;
          for (const polygon of f.geometry.coordinates) {
            fillPolygonWithHoles(tile, polygon, color, tileOriginX, tileOriginY);
          }
        }
      }

      // 2. Render lines
      for (const f of lineFeatures) {
        const style = LINE_STYLES[f.properties.type];
        const [cr, cg, cb, ca, width] = style;
        for (const segment of f.geometry.coordinates) {
          for (let i = 0; i < segment.length - 1; i++) {
            const px0 = lonToPixelX(segment[i][0], z) - tileOriginX;
            const py0 = latToPixelY(segment[i][1], z) - tileOriginY;
            const px1 = lonToPixelX(segment[i + 1][0], z) - tileOriginX;
            const py1 = latToPixelY(segment[i + 1][1], z) - tileOriginY;
            const margin = 10;
            if (Math.max(px0, px1) < -margin || Math.min(px0, px1) > TILE_SIZE + margin) continue;
            if (Math.max(py0, py1) < -margin || Math.min(py0, py1) > TILE_SIZE + margin) continue;
            drawLine(tile, px0, py0, px1, py1, [cr, cg, cb, ca], width);
          }
        }
      }

      // 3. Render POI icons
      if (includeIcons && poiDraws[key]) {
        for (const { icon, px, py } of poiDraws[key]) {
          compositeIcon(tile, icon, px, py);
        }
      }

      let hasContent = false;
      for (let i = 3; i < tile.data.length; i += 4) {
        if (tile.data[i] > 0) { hasContent = true; break; }
      }
      if (hasContent) {
        const pngBuf = PNG.sync.write(tile, { colorType: 6, deflateLevel: 6 });
        insertStmt.run([tx, ty, 17 - z, pngBuf]);
        tileCount++;
      }
    }
    console.log(`  Zoom ${z}: done`);
  }

  insertStmt.free();
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();
  console.log(`  Total: ${tileCount} tiles`);
}

async function main() {
  const SQL = await initSqlJs();
  await generateSqliteDb(SQL, 'lake-lucerne-with-icons.sqlitedb', true);
  await generateSqliteDb(SQL, 'lake-lucerne-without-icons.sqlitedb', false);
  console.log('\nDone!');
}

main();
