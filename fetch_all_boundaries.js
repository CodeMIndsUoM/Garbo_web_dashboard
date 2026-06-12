const fs = require('fs');

const councils = [
  { key: 'Colombo', id: 6331908 },
  { key: 'Dehiwala-Mt. Lavinia', id: 6263889 },
  { key: 'Kaduwela', id: 6222621 },
  { key: 'Moratuwa', id: 6359529 },
  { key: 'Sri Jayewardenepura Kotte', id: 1663189 }
];

const overpassQuery = `
[out:json][timeout:60];
(
  relation(6331908);
  relation(6263889);
  relation(6222621);
  relation(6359529);
  relation(1663189);
);
out geom;
`;

async function run() {
  console.log('Querying Overpass API for specific relation IDs...');
  const url = 'https://overpass-api.de/api/interpreter';
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(overpassQuery),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'GarboWasteManagementSystem/1.0'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log(`Found ${data.elements.length} elements`);
    
    const boundaries = {};
    
    for (const element of data.elements) {
      const councilConfig = councils.find(c => c.id === element.id);
      if (!councilConfig) continue;
      
      const key = councilConfig.key;
      console.log(`Processing "${key}" (OSM ID: ${element.id})...`);
      
      if (element.members) {
        const outerMembers = element.members.filter(m => m.type === 'way' && (m.role === 'outer' || !m.role));
        console.log(`  - Found ${outerMembers.length} outer ways`);
        
        let coordinates = stitchSegments(outerMembers.map(m => m.geometry.map(g => [g.lat, g.lng])));
        console.log(`  - Stitched into ${coordinates.length} points`);
        
        boundaries[key] = {
          council: key,
          id: element.id,
          boundaryPoints: coordinates.map(p => ({ lat: p[0], lng: p[1] }))
        };
      }
    }
    
    fs.writeFileSync('src/data/council_boundaries.json', JSON.stringify(boundaries, null, 2));
    console.log('Saved src/data/council_boundaries.json');
  } catch (err) {
    console.error('Overpass error:', err.message);
  }
}

function stitchSegments(segments) {
  if (segments.length === 0) return [];
  
  let remaining = [...segments];
  let current = remaining.shift();
  let points = [...current];
  
  while (remaining.length > 0) {
    const lastPoint = points[points.length - 1];
    let foundIndex = -1;
    let reverseFound = false;
    
    for (let i = 0; i < remaining.length; i++) {
      const seg = remaining[i];
      const startPoint = seg[0];
      const endPoint = seg[seg.length - 1];
      
      if (dist(lastPoint, startPoint) < 1e-5) {
        foundIndex = i;
        reverseFound = false;
        break;
      }
      if (dist(lastPoint, endPoint) < 1e-5) {
        foundIndex = i;
        reverseFound = true;
        break;
      }
    }
    
    if (foundIndex !== -1) {
      const seg = remaining.splice(foundIndex, 1)[0];
      const addition = reverseFound ? [...seg].reverse() : seg;
      points.push(...addition.slice(1));
    } else {
      if (remaining.length > 0) {
        const nextSeg = remaining.shift();
        points.push(...nextSeg);
      }
    }
  }
  
  return points;
}

function dist(p1, p2) {
  return Math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2);
}

run();
