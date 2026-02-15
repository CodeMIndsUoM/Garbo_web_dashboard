'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// 🔴 Smaller bin icon
const binIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/484/484662.png',
  iconSize: [16, 16],
  iconAnchor: [8, 16],
  popupAnchor: [0, -16],
});

interface BinData {
  id: string;
  lat: number;
  lng: number;
  fillLevel: number;
  priority: 'low' | 'medium' | 'high';
}

type BinMarkersMap = Map<string, { marker: L.Marker; data: BinData }>;

export const Map: React.FC = () => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const addModeRef = useRef(false);

  const [markers, setMarkers] = useState<BinMarkersMap>(new globalThis.Map());
  const [addMode, setAddMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; binId: string } | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current).setView([6.9271, 79.8612], 13);
    leafletMap.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Map click → add bin only if add mode enabled, also close context menu
    map.on('click', (e: L.LeafletMouseEvent) => {
      setContextMenu(null);
      
      if (!addModeRef.current) return;

      const { lat, lng } = e.latlng;
      addBin(lat, lng);
    });

    // Close context menu on map drag/zoom
    map.on('drag zoom', () => setContextMenu(null));
  }, []);

  const generateId = () => `BIN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addBin = (lat: number, lng: number) => {
    if (!leafletMap.current) return;

    const binData: BinData = {
      id: generateId(),
      lat,
      lng,
      fillLevel: Math.floor(Math.random() * 100), // Random for demo
      priority: 'medium',
    };

    const marker = L.marker([lat, lng], { icon: binIcon })
      .addTo(leafletMap.current);

    // Hover tooltip with bin info
    marker.bindTooltip(
      `<div style="font-size: 12px; line-height: 1.4;">
        <strong>ID:</strong> ${binData.id}<br/>
        <strong>Fill Level:</strong> ${binData.fillLevel}%<br/>
        <strong>Priority:</strong> ${binData.priority}
      </div>`,
      { permanent: false, direction: 'top', offset: [0, -10] }
    );

    // Right click → show context menu
    marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const containerPoint = leafletMap.current!.latLngToContainerPoint(e.latlng);
      setContextMenu({
        x: containerPoint.x,
        y: containerPoint.y,
        binId: binData.id,
      });
    });

    setMarkers((prev) => {
      const newMap = new globalThis.Map(prev);
      newMap.set(binData.id, { marker, data: binData });
      return newMap;
    });

    // TODO: send to backend
  };

  const removeBin = (binId: string) => {
    if (!leafletMap.current) return;

    const binEntry = markers.get(binId);
    if (binEntry) {
      leafletMap.current.removeLayer(binEntry.marker);
      setMarkers((prev) => {
        const newMap = new globalThis.Map(prev);
        newMap.delete(binId);
        return newMap;
      });

      // TODO: delete from backend
    }
    setContextMenu(null);
  };

  const changePriority = (binId: string, newPriority: 'low' | 'medium' | 'high') => {
    const binEntry = markers.get(binId);
    if (binEntry) {
      binEntry.data.priority = newPriority;
      
      // Update tooltip
      binEntry.marker.unbindTooltip();
      binEntry.marker.bindTooltip(
        `<div style="font-size: 12px; line-height: 1.4;">
          <strong>ID:</strong> ${binEntry.data.id}<br/>
          <strong>Fill Level:</strong> ${binEntry.data.fillLevel}%<br/>
          <strong>Priority:</strong> ${newPriority}
        </div>`,
        { permanent: false, direction: 'top', offset: [0, -10] }
      );

      setMarkers((prev) => {
        const newMap = new globalThis.Map(prev);
        newMap.set(binId, binEntry);
        return newMap;
      });

      // TODO: update backend
    }
    setContextMenu(null);
  };

  return (
    <div className="w-screen h-screen">
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] text-2xl font-semibold bg-white px-4 py-2 rounded shadow">
        Map View
      </div>

      <div ref={mapRef} className="w-full h-full" />

      {/* Add Bin Button */}
      <button
        onClick={() => setAddMode(!addMode)}
        className={`absolute top-4 right-4 z-[1000] px-4 py-3 rounded-lg shadow text-white font-semibold transition-colors ${
          addMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {addMode ? '✓ Click Map to Add Bin' : '+ Add New Bin Location'}
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="absolute z-[2000] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            onClick={() => removeBin(contextMenu.binId)}
            className="w-full px-4 py-2 text-left hover:bg-red-50 text-red-600 font-medium flex items-center gap-2"
          >
            <span>🗑️</span> Remove Bin
          </button>
          <div className="px-4 py-1 text-xs text-gray-600">
            <strong>ID:</strong> {contextMenu.binId}
          </div>
          <div className="border-t border-gray-200 my-1"></div>
          <div className="px-4 py-1 text-xs text-gray-500 font-semibold uppercase">Change Priority:</div>
          <button
            onClick={() => changePriority(contextMenu.binId, 'low')}
            className="w-full px-4 py-2 text-left hover:bg-green-50 text-sm flex items-center gap-2"
          >
            <span>🟢</span> Low Priority
          </button>
          <button
            onClick={() => changePriority(contextMenu.binId, 'medium')}
            className="w-full px-4 py-2 text-left hover:bg-yellow-50 text-sm flex items-center gap-2"
          >
            <span>🟡</span> Medium Priority
          </button>
          <button
            onClick={() => changePriority(contextMenu.binId, 'high')}
            className="w-full px-4 py-2 text-left hover:bg-red-50 text-sm flex items-center gap-2"
          >
            <span>🔴</span> High Priority
          </button>
        </div>
      )}
    </div>
  );
};
