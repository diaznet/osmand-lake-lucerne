/**
 * Extracts assets from the Mappuls Lake Lucerne APK and generates
 * a GPX file with POIs/labels for search in OsmAnd.
 *
 * Usage: node convert-to-osmand.js
 * Requires: com.mappuls.lakelucerne.apk in the same directory
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const apkPath = path.join(__dirname, 'com.mappuls.lakelucerne.apk');
const assetsDir = path.join(__dirname, 'lake-lucerne-assets');
const outDir = path.join(__dirname, 'osmand-output');

// --- Step 1: Extract APK assets ---
function extractApk() {
  if (fs.existsSync(assetsDir)) {
    console.log('Assets already extracted. Delete lake-lucerne-assets/ to re-extract.');
    return;
  }
  if (!fs.existsSync(apkPath)) {
    console.error('ERROR: Place com.mappuls.lakelucerne.apk in this directory.');
    process.exit(1);
  }
  console.log('Extracting assets from APK...');
  const buf = fs.readFileSync(apkPath);

  let eocdOffset = buf.length - 22;
  while (eocdOffset >= 0 && buf.readUInt32LE(eocdOffset) !== 0x06054b50) eocdOffset--;
  if (eocdOffset < 0) { console.error('Invalid APK'); process.exit(1); }

  const entries = [];
  let cdOffset = buf.readUInt32LE(eocdOffset + 16);
  while (buf.readUInt32LE(cdOffset) === 0x02014b50) {
    const method = buf.readUInt16LE(cdOffset + 10);
    const compSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localOffset = buf.readUInt32LE(cdOffset + 42);
    const name = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);
    entries.push({ name, method, compSize, localOffset });
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  let count = 0;
  for (const entry of entries) {
    if (!entry.name.startsWith('assets/')) continue;
    const relPath = entry.name.slice('assets/'.length);
    if (!relPath) continue;
    const outPath = path.join(assetsDir, relPath);
    if (entry.name.endsWith('/')) {
      fs.mkdirSync(outPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      const localNameLen = buf.readUInt16LE(entry.localOffset + 26);
      const localExtraLen = buf.readUInt16LE(entry.localOffset + 28);
      const dataStart = entry.localOffset + 30 + localNameLen + localExtraLen;
      const raw = buf.slice(dataStart, dataStart + entry.compSize);
      fs.writeFileSync(outPath, entry.method === 0 ? raw : zlib.inflateRawSync(raw));
      count++;
    }
  }
  console.log(`Extracted ${count} files.`);
}

// --- Step 2: Generate search GPX with OsmAnd icons ---
function generateGpx() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const points = JSON.parse(fs.readFileSync(path.join(assetsDir, 'points.json'), 'utf8'));
  const labels = JSON.parse(fs.readFileSync(path.join(assetsDir, 'labels.json'), 'utf8'));

  const POI_MAP = {
    1001: { name: 'Harbor', icon: 'special_sail_boat', color: '#4e4eff', cat: 'Harbors' },
    1002: { name: 'Buoy Red', icon: 'special_flag_stroke', color: '#ff0000', cat: 'Buoys' },
    1003: { name: 'Fuel', icon: 'fuel', color: '#ff8800', cat: 'Services' },
    1004: { name: 'Slipway', icon: 'slipway', color: '#4e4eff', cat: 'Harbors' },
    1006: { name: 'Parking', icon: 'parking', color: '#3f51b5', cat: 'Services' },
    1007: { name: 'Restaurant', icon: 'restaurant', color: '#ff8800', cat: 'Services' },
    1008: { name: 'Boat Station', icon: 'boat_sharing', color: '#4e4eff', cat: 'Harbors' },
    1009: { name: 'Kite Zone', icon: 'surfing', color: '#ff8800', cat: 'Sports' },
    1010: { name: 'Kite Launch', icon: 'surfing', color: '#4caf50', cat: 'Sports' },
    1011: { name: 'WC', icon: 'toilets', color: '#795548', cat: 'Services' },
    1012: { name: 'Swimming', icon: 'swimming_outdoor', color: '#2196f3', cat: 'Sports' },
    1013: { name: 'Diving', icon: 'scuba_diving', color: '#2196f3', cat: 'Sports' },
    1014: { name: 'Anchor Zone', icon: 'special_sail_boat', color: '#4e4eff', cat: 'Harbors' },
    1015: { name: 'Landmark', icon: 'special_photo_camera', color: '#4caf50', cat: 'Landmarks' },
    1016: { name: 'Ferry Stop', icon: 'ferry_terminal', color: '#3f51b5', cat: 'Transport' },
    1017: { name: 'Camping', icon: 'camping', color: '#4caf50', cat: 'Services' },
    1018: { name: 'Info', icon: 'special_information', color: '#3f51b5', cat: 'Services' },
    1019: { name: 'Waste', icon: 'waste_bin', color: '#795548', cat: 'Services' },
    1020: { name: 'Windsurf', icon: 'windsurfing', color: '#ff8800', cat: 'Sports' },
    1021: { name: 'Crane', icon: 'special_marker', color: '#607d8b', cat: 'Harbors' },
    1022: { name: 'Wakeboard', icon: 'waterskiing', color: '#ff8800', cat: 'Sports' },
    1023: { name: 'Buoy', icon: 'special_flag_stroke', color: '#ffeb3b', cat: 'Buoys' },
    1028: { name: 'Lock', icon: 'special_marker', color: '#607d8b', cat: 'Harbors' },
    1029: { name: 'Police', icon: 'police', color: '#3f51b5', cat: 'Services' },
    1030: { name: 'Customs', icon: 'customs', color: '#3f51b5', cat: 'Services' },
    1031: { name: 'Waterski', icon: 'waterskiing', color: '#ff8800', cat: 'Sports' },
    1032: { name: 'Kite Ban', icon: 'surfing', color: '#ff0000', cat: 'Sports' },
    1033: { name: 'SUP', icon: 'canoe', color: '#ff8800', cat: 'Sports' },
    1034: { name: 'Cardinal Buoy', icon: 'special_flag_stroke', color: '#000000', cat: 'Buoys' },
    1041: { name: 'Cleaning Station', icon: 'boat_sharing', color: '#4caf50', cat: 'Services' },
    1042: { name: 'Weather Station', icon: 'special_marker', color: '#2196f3', cat: 'Services' }
  };

  let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="OsmAnd"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:osmand="https://osmand.net"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
`;

  for (const f of points.features) {
    const [lon, lat] = f.geometry.coordinates;
    const type = f.properties.type;
    const poi = POI_MAP[type] || { name: 'POI ' + type, icon: 'special_marker', color: '#888888', cat: 'Other' };
    gpx += `  <wpt lat="${lat}" lon="${lon}">
    <name>${esc(poi.name)}</name>
    <type>${poi.cat}</type>
    <extensions>
      <osmand:icon>${poi.icon}</osmand:icon>
      <osmand:color>${poi.color}</osmand:color>
      <osmand:background>circle</osmand:background>
    </extensions>
  </wpt>
`;
  }

  for (const f of labels.features) {
    const [lon, lat] = f.geometry.coordinates;
    const isCity = f.properties.type === 4001;
    gpx += `  <wpt lat="${lat}" lon="${lon}">
    <name>${esc(f.properties.description)}</name>
    <type>Places</type>
    <extensions>
      <osmand:icon>${isCity ? 'city' : 'locality'}</osmand:icon>
      <osmand:color>#ffffff</osmand:color>
      <osmand:background>circle</osmand:background>
    </extensions>
  </wpt>
`;
  }

  gpx += `</gpx>`;
  fs.writeFileSync(path.join(outDir, 'lake-lucerne-favorites.gpx'), gpx);
  console.log('Generated osmand-output/lake-lucerne-favorites.gpx');
}

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// --- Run ---
extractApk();
generateGpx();
