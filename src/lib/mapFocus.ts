// Bin target passed from Bin Management to the map tab for pan + highlight.
export interface MapFocusBin {
  id: number;
  lat?: number;
  lng?: number;
  binCode?: string;
}

// Parses lat/lng from API fields or a "lat, lng" location string.
export function parseBinCoordinates(bin: {
  location?: string;
  coordinates?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
}): { lat: number; lng: number } | null {
  const lat = bin.lat ?? bin.latitude;
  const lng = bin.lng ?? bin.longitude;
  if (lat != null && lng != null) {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      return { lat: latNum, lng: lngNum };
    }
  }

  const source = bin.location || bin.coordinates || '';
  const parts = source.split(',').map((s) => s.trim());
  if (parts.length >= 2) {
    const latNum = parseFloat(parts[0]);
    const lngNum = parseFloat(parts[1]);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      return { lat: latNum, lng: lngNum };
    }
  }

  return null;
}
