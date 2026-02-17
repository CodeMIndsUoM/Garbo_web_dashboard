'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const API_BASE = "http://localhost:8080/api/bins";

// bin icon
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

type BinMarkersMap = globalThis.Map<string, { marker: L.Marker; data: BinData }>;

export default function MapView() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const addModeRef = useRef(false);

  const [markers, setMarkers] = useState<BinMarkersMap>(() => new globalThis.Map());
  const [addMode, setAddMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; binId: string } | null>(null);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  //  Load bins from backend
  const loadBins = async () => {
    try {
      const res = await fetch(API_BASE);
      
      if (!res.ok) {
        console.error('Failed to load bins:', res.status);
        return;
      }
      
      const bins = await res.json();
      console.log('✅ Loaded bins:', bins); // DEBUG

      bins.forEach((bin: any) => {
        console.log('🔍 Adding bin:', bin); // DEBUG
        console.log('🔍 bin.lat:', bin.lat, typeof bin.lat);
        console.log('🔍 bin.lng:', bin.lng, typeof bin.lng);
        
        addMarkerFromData({
          id: String(bin.id),
          lat: bin.lat,
          lng: bin.lng,
          fillLevel: bin.fillLevel,
          priority: bin.priority,
        });
      });
    } catch (error) {
      console.error('❌ Error loading bins:', error);
      alert('Failed to connect to backend. Make sure it is running on http://localhost:8080');
    }
  };

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const leafletInstance = L.map(mapRef.current).setView([6.9271, 79.8612], 13);
    leafletMapRef.current = leafletInstance;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
      .addTo(leafletInstance);

    leafletInstance.on('click', (e: L.LeafletMouseEvent) => {
      setContextMenu(null);

      if (!addModeRef.current) return;

      const { lat, lng } = e.latlng;
      addBin(lat, lng);
    });

    leafletInstance.on('drag zoom', () => setContextMenu(null));

    loadBins();
  }, []);

  //  Add marker helper
  const addMarkerFromData = (binData: BinData) => {
    if (!leafletMapRef.current) return;

    console.log('🎯 Creating marker for:', binData); // DEBUG

    const marker = L.marker([binData.lat, binData.lng], { icon: binIcon })
      .addTo(leafletMapRef.current);

    marker.bindTooltip(
      `<div>
        <strong>ID:</strong> ${binData.id}<br/>
        <strong>Fill Level:</strong> ${binData.fillLevel}%<br/>
        <strong>Priority:</strong> ${binData.priority}
      </div>`
    );

    marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      const pt = leafletMapRef.current!.latLngToContainerPoint(e.latlng);
      setContextMenu({ x: pt.x, y: pt.y, binId: binData.id });
    });

    setMarkers(prev => {
      const newMap = new globalThis.Map(prev);
      newMap.set(binData.id, { marker, data: binData });
      return newMap;
    });
  };

  //  Add bin
  const addBin = async (lat: number, lng: number) => {
    try {
      const newBin = {
        lat,
        lng,
        fillLevel: Math.floor(Math.random() * 100),
        priority: 'medium',
      };

      console.log('📤 Sending to backend:', newBin); // DEBUG

      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBin),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to create bin:', errorText);
        alert('Failed to add bin. Make sure the backend is running.');
        return;
      }

      const saved = await res.json();
      console.log('✅ Saved bin:', saved); // DEBUG

      addMarkerFromData({
        id: String(saved.id),
        lat: saved.lat,
        lng: saved.lng,
        fillLevel: saved.fillLevel,
        priority: saved.priority,
      });
    } catch (error) {
      console.error('Error adding bin:', error);
      alert('Failed to add bin. Make sure the backend is running on http://localhost:8080');
    }
  };

  //  Remove bin
  const removeBin = async (binId: string) => {
    try {
      const res = await fetch(`${API_BASE}/${binId}`, { method: "DELETE" });
      
      if (!res.ok) {
        console.error('Failed to delete bin');
        return;
      }

      const entry = markers.get(binId);
      if (entry && leafletMapRef.current) {
        leafletMapRef.current.removeLayer(entry.marker);

        setMarkers(prev => {
          const newMap = new globalThis.Map(prev);
          newMap.delete(binId);
          return newMap;
        });
      }

      setContextMenu(null);
      console.log('✅ Bin removed:', binId); // DEBUG
    } catch (error) {
      console.error('Error removing bin:', error);
    }
  };

  //  Change priority
  const changePriority = async (binId: string, priority: 'low' | 'medium' | 'high') => {
    try {
      const res = await fetch(`${API_BASE}/${binId}/priority?priority=${priority}`, {
        method: "PUT",
      });

      if (!res.ok) {
        console.error('Failed to update priority');
        return;
      }

      const entry = markers.get(binId);
      if (!entry) return;

      entry.data.priority = priority;

      entry.marker.unbindTooltip();
      entry.marker.bindTooltip(
        `<div>
          <strong>ID:</strong> ${entry.data.id}<br/>
          <strong>Fill Level:</strong> ${entry.data.fillLevel}%<br/>
          <strong>Priority:</strong> ${priority}
        </div>`
      );

      setMarkers(prev => new globalThis.Map(prev));
      setContextMenu(null);
      console.log('✅ Priority updated:', binId, priority); // DEBUG
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  return (
    <div className="w-screen h-screen">
      <div ref={mapRef} className="w-full h-full" />

      <button
        onClick={() => setAddMode(!addMode)}
        className={`absolute top-4 right-4 z-[1000] px-4 py-3 rounded text-white font-semibold transition-colors ${
          addMode ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {addMode ? '✓ Click Map to Add Bin' : '+ Add New Bin'}
      </button>

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
}