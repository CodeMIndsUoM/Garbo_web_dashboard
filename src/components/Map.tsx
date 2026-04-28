'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon as turfPolygon } from "@turf/helpers";
import { MapPin, Route, Plus, Navigation } from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';
const BINS_API = `${API_ORIGIN}/api/bins`;
const ROUTE_SESSION_API = `${API_ORIGIN}/api/route-sessions`;
const DEPOT_LAT = 6.775080;
const DEPOT_LNG = 79.882289;
const DEFAULT_VEHICLE_COUNT = 3;
const DEFAULT_VEHICLE_CAPACITY = 25;
const ROUTE_COLORS = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#db2777', '#0891b2'];

const binIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;background-color:#f97316;border:2px solid white;border-radius:50%;box-shadow:0 3px 6px rgba(0,0,0,0.35);"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const depotIcon = L.divIcon({
  html: `<div style="width:36px;height:36px;background-color:#9333ea;border:2px solid white;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-4 9 4v13"></path><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"></path></svg></div>`,
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 36],
});

const selectedBinIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;background-color:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 4px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface BinData {
  id: string;
  lat: number;
  lng: number;
  fillLevel: number;
  priority: 'low' | 'medium' | 'high';
  zone: string;
}

interface RouteBinStop {
  stopOrder: number;
  binId: number;
  lat: number;
  lng: number;
  durationFromPrevStopSeconds: number;
}

interface VehicleRoute {
  vehicleId: number;
  capacity: number;
  totalBins: number;
  estimatedDurationSeconds: number;
  binSequence: RouteBinStop[];
}

interface RouteResponse {
  totalVehiclesUsed: number;
  routes: Record<string, VehicleRoute>;
}

interface RouteSessionSnapshot {
  sessionId: string;
  userId: number;
  version: number;
  status: 'PROCESSING' | 'READY' | 'ERROR' | 'SESSION_CREATED';
  trigger: string;
  selectedBinIds: number[];
  addedBinIds: number[];
  removedBinIds: number[];
  route: RouteResponse | null;
  message: string | null;
}

type BinMarkersMap = Map<string, { marker: L.Marker; data: BinData }>;
const ZONE_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

export default function MapView() {

  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const addModeRef = useRef(false);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);
  const stompClientRef = useRef<Client | null>(null);

  const [markers, setMarkers] = useState<BinMarkersMap>(new Map());
  const [addMode, setAddMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<any>(null);
  // 🔽 NEW STATES
  const [showRouteMenu, setShowRouteMenu] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBins, setSelectedBins] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<string>('');
  const [routeError, setRouteError] = useState<string>('');
  const [vehicleCountInput, setVehicleCountInput] = useState<string>('');
  const [vehicleCapacityInput, setVehicleCapacityInput] = useState<string>('');
  const selectionModeRef = useRef(false);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  const toggleBinSelection = (id: string) => {
    setSelectedBins(prev => {
      const isSelected = prev.includes(id);
      const newSelected = isSelected ? prev.filter(b => b !== id) : [...prev, id];

      setMarkers(currentMarkers => {
        const m = new Map(currentMarkers);
        const entry = m.get(id);
        if (entry) {
          entry.marker.setIcon(isSelected ? binIcon : selectedBinIcon);
        }
        return m;
      });
      return newSelected;
    });
  };

  const clearSelectedBinIcons = (ids: string[]) => {
    ids.forEach(id => {
      const entry = markers.get(id);
      if (entry) {
        entry.marker.setIcon(binIcon);
      }
    });
  };

  const clearRouteVisualization = () => {
    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers();
    }
  };

  const getCurrentUserId = () => {
    if (typeof window === 'undefined') {
      return 1;
    }

    const raw = localStorage.getItem('admin');
    if (!raw) {
      return 1;
    }

    try {
      const admin = JSON.parse(raw);
      const idCandidate = Number(admin?.id ?? admin?.userId);
      return Number.isFinite(idCandidate) && idCandidate > 0 ? idCandidate : 1;
    } catch {
      return 1;
    }
  };

  const buildRoadPolyline = async (stops: RouteBinStop[], color: string, vehicleId: string) => {
    if (!routeLayerRef.current || !leafletMapRef.current || stops.length === 0) {
      return;
    }

    const pathCoordinates: [number, number][] = [
      [DEPOT_LAT, DEPOT_LNG],
      ...stops.map(stop => [stop.lat, stop.lng] as [number, number]),
      [DEPOT_LAT, DEPOT_LNG]
    ];

    const osrmCoordString = pathCoordinates
      .map(([lat, lng]) => `${lng},${lat}`)
      .join(';');

    try {
      const osrmRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${osrmCoordString}?overview=full&geometries=geojson`
      );
      if (!osrmRes.ok) {
        throw new Error(`OSRM request failed for vehicle ${vehicleId}`);
      }

      const osrmJson = await osrmRes.json();
      const coords = osrmJson?.routes?.[0]?.geometry?.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length === 0) {
        throw new Error('No geometry from OSRM');
      }

      const latLngs: [number, number][] = coords.map((coord: [number, number]) => [coord[1], coord[0]]);

      L.polyline(latLngs, {
        color,
        weight: 5,
        opacity: 0.85
      })
        .bindTooltip(`Vehicle ${vehicleId}`)
        .addTo(routeLayerRef.current);
    } catch {
      L.polyline(pathCoordinates, {
        color,
        weight: 3,
        opacity: 0.6,
        dashArray: '8, 6'
      })
        .bindTooltip(`Vehicle ${vehicleId} (fallback)`)
        .addTo(routeLayerRef.current);
    }
  };

  const visualizeRoutes = async (snapshot: RouteSessionSnapshot) => {
    if (!leafletMapRef.current || !snapshot.route?.routes) {
      return;
    }

    clearRouteVisualization();

    const routeEntries = Object.entries(snapshot.route.routes);
    await Promise.all(routeEntries.map(async ([vehicleKey, vehicleRoute], index) => {
      const color = ROUTE_COLORS[index % ROUTE_COLORS.length];
      await buildRoadPolyline(vehicleRoute.binSequence || [], color, vehicleKey);
    }));

    if (routeLayerRef.current) {
      const bounds = routeLayerRef.current.getBounds();
      if (bounds.isValid()) {
        leafletMapRef.current.fitBounds(bounds.pad(0.15));
      }
    }
  };

  const disconnectRouteSocket = () => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
    }
  };

  const connectRouteSocket = (sessionId: string) => {
    disconnectRouteSocket();

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_ORIGIN}/ws`),
      reconnectDelay: 2000,
      debug: () => { }
    });

    client.onConnect = () => {
      client.subscribe(`/topic/route-sessions/${sessionId}`, async (message) => {
        try {
          const snapshot = JSON.parse(message.body) as RouteSessionSnapshot;
          setActiveSessionId(snapshot.sessionId);
          setRouteStatus(snapshot.status || '');

          if (snapshot.status === 'ERROR') {
            setRouteError(snapshot.message || 'Route optimization failed');
            return;
          }

          if (snapshot.status === 'READY') {
            setRouteError('');
            await visualizeRoutes(snapshot);
          }
        } catch (error) {
          console.error('Failed to parse websocket route snapshot', error);
        }
      });
    };

    client.onStompError = (frame) => {
      setRouteError(frame.headers['message'] || 'Websocket broker error');
    };

    client.onWebSocketError = () => {
      setRouteError('Websocket connection error');
    };

    client.activate();
    stompClientRef.current = client;
  };

  // ===============================
  // 🗺️ POLYGON
  // ===============================
  const municipalCoords: [number, number][] = [
    [6.811952, 79.867387],
    [6.82722, 79.93127],
    [6.76338, 79.9669],
    [6.716461, 79.901547]
  ];

  const coords = municipalCoords.map(([lat, lng]) => [lng, lat]);
  coords.push(coords[0]);
  const turfPoly = turfPolygon([coords]);

  // ===============================
  // MAP INIT
  // ===============================
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const leafletPoly = L.polygon(municipalCoords);
    const bounds = leafletPoly.getBounds();

    const map = L.map(mapRef.current, {
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
      zoomControl: false
    });

    map.fitBounds(bounds);
    map.setMinZoom(map.getZoom());
    map.setMaxZoom(18);

    leafletMapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      noWrap: true
    }).addTo(map);

    leafletPoly.addTo(map).setStyle({
      color: "#2563eb",
      weight: 2,
      fillOpacity: 0
    });

    const world: [number, number][] = [
      [-90, -180],
      [-90, 180],
      [90, 180],
      [90, -180]
    ];

    L.polygon([world, municipalCoords], {
      color: "transparent",
      fillColor: "#ffffff",
      fillOpacity: 1.0,
      interactive: false
    }).addTo(map);

    const depotMarker = L.marker([DEPOT_LAT, DEPOT_LNG], { icon: depotIcon })
      .addTo(map);
    depotMarker.bindTooltip("<div class='font-bold text-sm'>Central Depot</div>", {
      direction: 'top',
      permanent: false,
      offset: [0, -10]
    });

    map.on('click', (e: L.LeafletMouseEvent) => {

      setContextMenu(null);

      if (!addModeRef.current) return;

      const pt = point([e.latlng.lng, e.latlng.lat]);

      if (!booleanPointInPolygon(pt, turfPoly)) {
        alert("Outside municipal area!");
        return;
      }

      addBin(e.latlng.lat, e.latlng.lng);
    });

    loadBins();

    routeLayerRef.current = L.featureGroup().addTo(map);

    return () => {
      disconnectRouteSocket();
      if (routeLayerRef.current) {
        routeLayerRef.current.clearLayers();
      }
    };

  }, []);

  // ===============================
  // LOAD BINS
  // ===============================
  const loadBins = async () => {
    const res = await fetch(BINS_API);
    if (!res.ok) {
      console.error(`Failed to load bins: ${res.status}`);
      return;
    }

    const payload = await res.json();
    const bins = Array.isArray(payload) ? payload : Array.isArray(payload?.value) ? payload.value : [];

    bins.forEach((bin: any) => {
      addMarker({
        id: String(bin.id),
        lat: Number(bin.lat),
        lng: Number(bin.lng),
        fillLevel: bin.fillLevel,
        priority: bin.priority,
        zone: bin.zone || 'unassigned'
      });
    });

    if (bins.length === 0) {
      console.warn('No bins were returned for map rendering');
    }
  };

  // ===============================
  // TOOLTIP
  // ===============================
  const renderTooltip = (d: BinData) => `
    <div>
      <strong>ID:</strong> ${d.id}<br/>
      <strong>Fill:</strong> ${d.fillLevel}%<br/>
      <strong>Priority:</strong> ${d.priority}<br/>
      <strong>Zone:</strong> ${d.zone}
    </div>
  `;

  // ===============================
  // MARKER
  // ===============================
  const addMarker = (data: BinData) => {
    if (!leafletMapRef.current) return;

    const marker = L.marker([data.lat, data.lng], { icon: binIcon })
      .addTo(leafletMapRef.current);

    marker.bindTooltip(renderTooltip(data));

    marker.on('click', () => {
      if (selectionModeRef.current) {
        toggleBinSelection(data.id);
      }
    });

    marker.on('contextmenu', (e: any) => {
      const pt = leafletMapRef.current!.latLngToContainerPoint(e.latlng);
      setContextMenu({ x: pt.x, y: pt.y, binId: data.id });
    });

    setMarkers(prev => {
      const m = new Map(prev);
      m.set(data.id, { marker, data });
      return m;
    });
  };

  // ===============================
  // ADD BIN
  // ===============================
  const addBin = async (lat: number, lng: number) => {
    const res = await fetch(BINS_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat, lng,
        fillLevel: Math.floor(Math.random() * 100),
        priority: 'medium',
        zone: 'unassigned'
      })
    });

    const saved = await res.json();

    addMarker({
      id: String(saved.id),
      lat: saved.lat,
      lng: saved.lng,
      fillLevel: saved.fillLevel,
      priority: saved.priority,
      zone: saved.zone
    });
  };

  // ===============================
  // REMOVE BIN
  // ===============================
  const removeBin = async (id: string) => {
    const res = await fetch(`${BINS_API}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      console.error(`Failed to delete bin ${id}`);
      return;
    }

    const entry = markers.get(id);
    if (entry && leafletMapRef.current) {
      leafletMapRef.current.removeLayer(entry.marker);
    }

    setMarkers(prev => {
      const m = new Map(prev);
      m.delete(id);
      return m;
    });

    setContextMenu(null);
  };

  // ===============================
  // UPDATE BIN
  // ===============================
  const updateBinLocally = (id: string, updates: Partial<BinData>) => {
    const entry = markers.get(id);
    if (!entry) return;

    const newData = { ...entry.data, ...updates };
    entry.data = newData;
    entry.marker.bindTooltip(renderTooltip(newData));
    setMarkers(new Map(markers));
  };

  const updatePriority = async (id: string, priority: BinData['priority']) => {
    try {
      const res = await fetch(
        `${BINS_API}/${id}/priority?priority=${encodeURIComponent(priority)}`,
        { method: "PUT" }
      );
      if (!res.ok) {
        throw new Error(`Priority update failed for bin ${id}`);
      }
      updateBinLocally(id, { priority });
    } catch (e) {
      console.error("Failed to update bin", e);
    }
  };

  const updateZone = async (id: string, zone: string) => {
    try {
      const res = await fetch(
        `${BINS_API}/${id}/zone?zone=${encodeURIComponent(zone)}`,
        { method: "PUT" }
      );
      if (!res.ok) {
        throw new Error(`Zone update failed for bin ${id}`);
      }
      updateBinLocally(id, { zone });
    } catch (e) {
      console.error("Failed to update bin", e);
    }
  };

  // ===============================
  // ROUTE ACTIONS (NEW)
  // ===============================
  const handleSelectBins = () => {
    setSelectionMode(true);
    setSelectedBins([]);
    clearRouteVisualization();
    setRouteError('');
    setRouteStatus('');
    setAddMode(false);
    setShowRouteMenu(false);
  };

  const handleOptimizeZone = async () => {
    alert("Trigger route optimization for zones");

    // 🔥 you can call backend here
    // await fetch("/api/routes/optimize", {...})

    setShowRouteMenu(false);
  };

  return (
    <div className="w-full h-full relative">

      <div ref={mapRef} className="w-full h-full" />

      {/* SELECTION OVERLAY */}
      {selectionMode && (
        <div style={{ zIndex: 9999 }} className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-top-4">
          <span className="font-semibold text-sm">Selecting Bins: {selectedBins.length} selected</span>
          <div className="flex items-center gap-2 text-xs">
            <input
              type="number"
              min={1}
              placeholder="Vehicles (default 3)"
              value={vehicleCountInput}
              onChange={(e) => setVehicleCountInput(e.target.value)}
              className="w-36 rounded border border-white/30 bg-white/15 px-2 py-1 placeholder:text-white/70 text-white outline-none"
            />
            <input
              type="number"
              min={1}
              placeholder="Capacity (default 25)"
              value={vehicleCapacityInput}
              onChange={(e) => setVehicleCapacityInput(e.target.value)}
              className="w-40 rounded border border-white/30 bg-white/15 px-2 py-1 placeholder:text-white/70 text-white outline-none"
            />
          </div>
          <div className="flex items-center bg-white/20 rounded p-1 text-sm font-medium">
            <button
              onClick={async () => {
                if (selectedBins.length === 0) {
                  alert("Please select at least one bin");
                  return;
                }

                const requestedVehicleCount = Number(vehicleCountInput);
                const requestedCapacity = Number(vehicleCapacityInput);

                const vehicleCount = Number.isFinite(requestedVehicleCount) && requestedVehicleCount > 0
                  ? Math.floor(requestedVehicleCount)
                  : DEFAULT_VEHICLE_COUNT;

                const capacity = Number.isFinite(requestedCapacity) && requestedCapacity > 0
                  ? Math.floor(requestedCapacity)
                  : DEFAULT_VEHICLE_CAPACITY;

                try {
                  const selectedBinIds = selectedBins
                    .map((id) => Number(id))
                    .filter((id) => Number.isFinite(id));

                  const res = await fetch(ROUTE_SESSION_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: getCurrentUserId(),
                      vehicleCount,
                      vehicleCapacities: Array.from({ length: vehicleCount }, () => capacity),
                      depotLat: DEPOT_LAT,
                      depotLng: DEPOT_LNG,
                      selectedBinIds
                    })
                  });

                  if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(errorText || 'Failed to create route session');
                  }

                  const snapshot = await res.json() as RouteSessionSnapshot;
                  setRouteStatus(snapshot.status || 'PROCESSING');
                  setRouteError('');
                  setActiveSessionId(snapshot.sessionId);
                  connectRouteSocket(snapshot.sessionId);

                  // Exit mode
                  setSelectionMode(false);
                  clearSelectedBinIcons(selectedBins);
                  setSelectedBins([]);
                } catch (e) {
                  console.error(e);
                  alert("Error generating routes");
                }
              }}
              className="px-3 py-1 hover:text-green-300 transition-colors"
            >
              Generate Route
            </button>
            <span className="w-px h-4 bg-white/40 mx-1"></span>
            <button
              onClick={() => {
                setSelectionMode(false);
                clearSelectedBinIcons(selectedBins);
                setSelectedBins([]);
              }}
              className="px-3 py-1 hover:text-red-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(routeStatus || routeError || activeSessionId) && (
        <div style={{ zIndex: 9999 }} className="absolute bottom-4 left-4 bg-white/95 border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm max-w-sm">
          <div className="font-semibold text-gray-800">Route Session</div>
          {activeSessionId && <div className="text-xs text-gray-500 mt-1">Session: {activeSessionId}</div>}
          {routeStatus && <div className="text-sm mt-1">Status: <span className="font-medium text-blue-700">{routeStatus}</span></div>}
          {routeError && <div className="text-sm mt-1 text-red-600">{routeError}</div>}
        </div>
      )}

      {/* ADD BIN */}
      <button
        style={{ zIndex: 9999 }}
        onClick={() => setAddMode(!addMode)}
        className={`absolute top-4 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-md transition-all duration-200 active:scale-95 ${addMode
          ? "bg-amber-500 hover:bg-amber-600 text-white"
          : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg"
          }`}
      >
        <Plus className={`w-4 h-4 transition-transform duration-200 ${addMode ? "rotate-45" : ""}`} />
        {addMode ? "Click Map to Add" : "Add Bin"}
      </button>

      {/* CREATE ROUTE BUTTON */}
      <button
        style={{ zIndex: 9999 }}
        onClick={() => setShowRouteMenu(!showRouteMenu)}
        className={`absolute top-16 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-md transition-all duration-200 active:scale-95 ${showRouteMenu
          ? "bg-gray-800 hover:bg-gray-900 text-white hover:shadow-lg"
          : "bg-green-600 hover:bg-green-700 text-white hover:shadow-lg"
          }`}
      >
        <Navigation className={`w-4 h-4 transition-transform duration-200 ${showRouteMenu ? "-rotate-90" : ""}`} />
        Create Route
      </button>

      {/* DROPDOWN */}
      {showRouteMenu && (
        <div style={{ zIndex: 9999 }} className="absolute top-28 right-4 z-[2000] bg-white rounded-xl shadow-xl border border-gray-100 w-72 overflow-hidden flex flex-col">
          <button
            onClick={handleSelectBins}
            className="flex items-start text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 group"
          >
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 group-hover:text-blue-700 transition-colors shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="ml-3">
              <span className="block font-semibold text-gray-800 text-sm">Select Bins</span>
              <span className="block text-xs text-gray-500 mt-0.5">Manually choose specific bins on the map</span>
            </div>
          </button>

          <button
            onClick={handleOptimizeZone}
            className="flex items-start text-left px-4 py-3 hover:bg-green-50 transition-colors group"
          >
            <div className="p-2 bg-green-100 text-green-600 rounded-lg group-hover:bg-green-200 group-hover:text-green-700 transition-colors shrink-0">
              <Route className="w-5 h-5" />
            </div>
            <div className="ml-3">
              <span className="block font-semibold text-gray-800 text-sm">Optimize by Zone</span>
              <span className="block text-xs text-gray-500 mt-0.5">Auto-generate the most efficient collection route</span>
            </div>
          </button>
        </div>
      )}

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="absolute bg-white shadow-xl rounded-lg p-2 z-[2000] min-w-[180px] border border-gray-100 flex flex-col gap-1"
        >
          <div className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase tracking-wider flex justify-between items-center">
            <span>Manage Bin</span>
            <button onClick={() => setContextMenu(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>

          <div className="px-2 py-1">
            <label className="text-xs text-gray-700 font-medium block mb-1">Priority</label>
            <select
              className="w-full text-sm border border-gray-200 rounded p-1.5 bg-gray-50 focus:ring focus:ring-blue-200 focus:border-blue-400 outline-none"
              value={markers.get(contextMenu.binId)?.data.priority || 'medium'}
              onChange={(e) => updatePriority(contextMenu.binId, e.target.value as BinData['priority'])}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="px-2 py-1">
            <label className="text-xs text-gray-700 font-medium block mb-1">Zone</label>
            <select
              className="w-full text-sm border border-gray-200 rounded p-1.5 bg-gray-50 focus:ring focus:ring-blue-200 focus:border-blue-400 outline-none"
              value={markers.get(contextMenu.binId)?.data.zone || 'unassigned'}
              onChange={(e) => updateZone(contextMenu.binId, e.target.value)}
            >
              <option value="unassigned">Unassigned</option>
              {ZONE_OPTIONS.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>

          <hr className="my-1 border-gray-100" />

          <button
            onClick={() => removeBin(contextMenu.binId)}
            className="text-left px-2 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors font-medium flex items-center gap-2"
          >
            🗑 Remove Bin
          </button>
        </div>
      )}

    </div>
  );
}