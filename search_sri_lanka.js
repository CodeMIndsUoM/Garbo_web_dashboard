const fs = require('fs');

const overpassQuery = `
[out:json][timeout:60];
area["name"="Sri Lanka"]->.srilanka;
(
  relation["boundary"="administrative"]["name"~"Colombo|Dehiwala|Moratuwa|Kaduwela|Kotte"](area.srilanka);
);
out tags;
`;

async function run() {
  console.log('Querying Overpass API for Sri Lanka relations...');
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
    
    data.elements.forEach(el => {
      console.log(`ID: ${el.id} | Name: "${el.tags.name}" | admin_level: ${el.tags.admin_level} | boundary: ${el.tags.boundary}`);
    });
  } catch (err) {
    console.error('Overpass error:', err.message);
  }
}

run();
