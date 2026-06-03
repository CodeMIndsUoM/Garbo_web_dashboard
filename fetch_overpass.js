const fs = require('fs');

const overpassQuery = `
[out:json][timeout:60];
(
  relation["boundary"="administrative"]["name"="Colombo"];
  relation["boundary"="administrative"]["name"="Dehiwala-Mount Lavinia"];
  relation["boundary"="administrative"]["name"="Kaduwela"];
  relation["boundary"="administrative"]["name"="Moratuwa"];
  relation["boundary"="administrative"]["name"="Sri Jayewardenepura Kotte"];
);
out geom;
`;

async function run() {
  console.log('Querying Overpass API...');
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
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.elements.length} elements`);
    
    const boundaries = {};
    
    for (const element of data.elements) {
      const name = element.tags.name;
      console.log(`Processing ${name} (OSM ID: ${element.id})...`);
      
      // Reconstruct boundary polygon from relation geometry
      // A relation has members. Each member of type 'way' with role 'outer' (or no role if simple) forms the boundary.
      // With 'out geom', each way member has a 'geometry' array of {lat, lng}
      if (element.members) {
        // Collect all outer ways
        const ways = element.members.filter(m => m.type === 'way' && (m.role === 'outer' || !m.role));
        console.log(`  - Found ${ways.length} outer ways`);
        
        // Let's extract the coordinate paths
        const segments = ways.map(w => w.geometry.map(g => [g.lat, g.lng]));
        
        // Simple stitching or we can just save it as MultiLineString/Polygon
        boundaries[name] = {
          id: element.id,
          name: name,
          segments: segments
        };
      }
    }
    
    fs.writeFileSync('src/data/osm_boundaries_raw.json', JSON.stringify(boundaries, null, 2));
    console.log('Saved src/data/osm_boundaries_raw.json');
  } catch (err) {
    console.error('Overpass error:', err.message);
  }
}

run();
