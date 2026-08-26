const fs = require('fs');
const geoData = JSON.parse(fs.readFileSync('wards_simplified.geojson', 'utf8'));

// Function to clean ward name
function cleanWardName(rawWard) {
  if (!rawWard) return 'Unknown';
  let v = String(rawWard).trim();
  if (v.endsWith('.0')) v = v.slice(0, -2);
  v = v.replace(/^(prabhag|ward)\s*(no\.?)?\s*/i, '');
  v = v.trim().replace(/^0+/, '');
  return v === '' ? '0' : v;
}

// Ray-casting algorithm
function isPointInPolygon(point, polygon) {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getRandomPointInFeature(feature) {
  const geomType = feature.geometry.type;
  const coords = feature.geometry.coordinates;
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  function updateBounds(ring) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (geomType === 'Polygon') {
    updateBounds(coords[0]);
  } else if (geomType === 'MultiPolygon') {
    for (const poly of coords) updateBounds(poly[0]);
  } else {
    return null;
  }

  let attempts = 0;
  while (attempts < 1000) {
    const rx = minX + Math.random() * (maxX - minX);
    const ry = minY + Math.random() * (maxY - minY);
    
    let inside = false;
    if (geomType === 'Polygon') {
      for (const ring of coords) {
        if (isPointInPolygon([rx, ry], ring)) { inside = true; break; }
      }
    } else if (geomType === 'MultiPolygon') {
      for (const poly of coords) {
        for (const ring of poly) {
          if (isPointInPolygon([rx, ry], ring)) { inside = true; break; }
        }
        if (inside) break;
      }
    }
    
    if (inside) return [rx, ry];
    attempts++;
  }
  
  return [(minX + maxX)/2, (minY + maxY)/2];
}

const csvFile = 'C:\\Users\\msuna\\.gemini\\antigravity-ide\\brain\\5f6c267a-2556-48a0-ba7e-49b5c5d3c3c3\\.system_generated\\steps\\51\\content.md';
let csvContent = fs.readFileSync(csvFile, 'utf8');

// The file has a header like "Title: Live Content..." at the top. We need to find the actual CSV start.
const csvStartIndex = csvContent.indexOf('Patient_Name,Date');
if (csvStartIndex > -1) {
    csvContent = csvContent.substring(csvStartIndex);
}

const lines = csvContent.split('\n');
const header = lines[0].trim().split(',');

const latIdx = header.indexOf('Lat');
const lngIdx = header.indexOf('Long');
const wardIdx = header.indexOf('Ward_Name');

if (latIdx === -1 || lngIdx === -1 || wardIdx === -1) {
    console.error("Couldn't find required columns");
    process.exit(1);
}

const featureMap = {};
for (const feature of geoData.features) {
    const name = feature.properties.name || '';
    featureMap[cleanWardName(name)] = feature;
}

let outLines = [lines[0].trim()];

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV split (doesn't handle quoted commas, but this dataset seems simple)
    const cols = line.split(',');
    
    if (cols.length >= wardIdx) {
        let wardStr = cols[wardIdx];
        let cWard = cleanWardName(wardStr);
        
        if (!cols[latIdx] || !cols[lngIdx]) {
            const feature = featureMap[cWard];
            if (feature) {
                const pt = getRandomPointInFeature(feature);
                if (pt) {
                    cols[latIdx] = pt[1].toFixed(6); // Lat
                    cols[lngIdx] = pt[0].toFixed(6); // Lng
                }
            }
        }
        outLines.push(cols.join(','));
    } else {
        outLines.push(line);
    }
}

fs.writeFileSync('filled_patients.csv', outLines.join('\n'), 'utf8');
console.log('Successfully generated filled_patients.csv');
