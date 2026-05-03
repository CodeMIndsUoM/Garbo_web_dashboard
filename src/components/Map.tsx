'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon as turfPolygon } from "@turf/helpers";
import { MapPin, Route, Plus, Navigation } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';
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
  binCode?: string;
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

export default function MapView({ council }: { council?: { name?: string } | null }) {

  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const addModeRef = useRef(false);
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);
  const stompClientRef = useRef<Client | null>(null);

  const [markers, setMarkers] = useState<BinMarkersMap>(new Map());
  const [addMode, setAddMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, binId: string } | null>(null);
  const [showRouteMenu, setShowRouteMenu] = useState(false);
  const [showAssignedRouteMenu, setShowAssignedRouteMenu] = useState(false);
  const [assignedRoutes, setAssignedRoutes] = useState<any[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newBin, setNewBin] = useState({
    location: '',
    type: 'General Waste',
    zone: ''
  });

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedBins, setSelectedBins] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [routeStatus, setRouteStatus] = useState<string>('');
  const [routeError, setRouteError] = useState<string>('');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [collectors, setCollectors] = useState<any[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedCollectorIds, setSelectedCollectorIds] = useState<string[]>([]);
  const selectionModeRef = useRef(false);

  const nextBinCode = useMemo(() => {
    if (!council?.name) return 'Auto-generated';
    const prefix = `${council.name.trim()}-`.toLowerCase();
    
    let maxNumber = 0;
    markers.forEach((entry) => {
      const code = entry.data.binCode?.toLowerCase() || '';
      if (code.startsWith(prefix)) {
        const numStr = code.slice(prefix.length).trim();
        if (/^\d+$/.test(numStr)) {
          maxNumber = Math.max(maxNumber, parseInt(numStr, 10));
        }
      }
    });
    
    return `${council.name.trim()}-${maxNumber + 1}`;
  }, [council, markers]);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  useEffect(() => {
    const fetchResources = async () => {
      const token = localStorage.getItem('token');
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        const [vehRes, drvRes, usrRes] = await Promise.all([
          fetch(`${API_ORIGIN}/api/vehicles`, { headers: authHeaders }),
          fetch(`${API_ORIGIN}/api/drivers`, { headers: authHeaders }),
          fetch(`${API_ORIGIN}/api/users`, { headers: authHeaders })
        ]);

        if (vehRes.ok) {
          const vehJson = await vehRes.json();
          if (vehJson.success) setVehicles(vehJson.data);
        }
        if (drvRes.ok) {
          const drvJson = await drvRes.json();
          if (drvJson.success) setDrivers(drvJson.data);
        }
        if (usrRes.ok) {
          const usrJson = await usrRes.json();
          if (usrJson.data) {
            setCollectors(usrJson.data.filter((u: any) => u.role === 'COLLECTOR'));
          }
        }
      } catch (e) {
        console.error('Failed to fetch routing resources', e);
      }
    };
    fetchResources();
  }, []);

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

      setNewBin(prev => ({...prev, location: `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`}));
      setIsCreateModalOpen(true);
      setAddMode(false);
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
    let bins: any[] = [];
    if (Array.isArray(payload)) {
      bins = payload;
    } else if (payload?.data && Array.isArray(payload.data)) {
      bins = payload.data;
    } else if (payload?.value && Array.isArray(payload.value)) {
      bins = payload.value;
    }

    bins.forEach((bin: any) => {
      const lat = Number(bin.lat ?? bin.latitude);
      const lng = Number(bin.lng ?? bin.longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.warn('Skipping bin with invalid coordinates', bin);
        return;
      }

      addMarker({
        id: String(bin.id),
        binCode: bin.binCode,
        lat,
        lng,
        fillLevel: bin.fillLevel,
        priority: bin.priority || 'medium',
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
      <strong>Code:</strong> ${d.binCode || d.id}<br/>
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

    marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
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
  const handleCreateBinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(BINS_API, {
        method: "POST",
        headers,
        body: JSON.stringify({
          location: newBin.location,
          type: newBin.type,
          zone: newBin.zone,
          fillLevel: 0,
          priority: 'medium',
          status: 'normal'
        })
      });

      if (!res.ok) {
        let errMessage = 'Failed to create bin';
        try {
          const errData = await res.json();
          errMessage = errData.message || errMessage;
        } catch(e) {}
        throw new Error(errMessage);
      }

      const responseData = await res.json();
      const saved = responseData.data || responseData;

      addMarker({
        id: String(saved.id),
        binCode: saved.binCode,
        lat: saved.lat || saved.latitude,
        lng: saved.lng || saved.longitude,
        fillLevel: saved.fillLevel || 0,
        priority: saved.priority || 'medium',
        zone: saved.zone || newBin.zone
      });

      setIsCreateModalOpen(false);
      setNewBin({ location: '', type: 'General Waste', zone: '' });
    } catch(err) {
      console.error(err);
      const e = err as Error;
      alert(e.message || "Error creating bin");
    }
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
  // ROUTE ACTIONS
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
    setShowRouteMenu(false);
  };

  // ===============================
  // ASSIGNED ROUTES — CHANGE 1 & 2
  // ===============================
  const handleToggleAssignedRoutes = async () => {
    setShowAssignedRouteMenu(!showAssignedRouteMenu);
    if (!showAssignedRouteMenu && assignedRoutes.length === 0) {
      setLoadingRoutes(true);
      try {
        const userId = getCurrentUserId();
        // Try the user-scoped active sessions endpoint first;
        // fall back to /api/routes/active if your backend exposes that instead.
        const res = await fetch(
          `${API_ORIGIN}/api/route-sessions/user/${userId}/active`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        if (res.ok) {
          const json = await res.json();
          setAssignedRoutes(Array.isArray(json) ? json : (json.data || []));
        }
      } catch (e) {
        console.error('Failed to fetch assigned routes', e);
      } finally {
        setLoadingRoutes(false);
      }
    }
  };

  return (
    <div className="w-full h-full relative">

      <div ref={mapRef} className="w-full h-full" />

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent style={{ zIndex: 10000 }} className="z-[10000] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Waste Bin</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBinSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Bin Code (Auto-generated)</label>
              <Input 
                value={nextBinCode}
                disabled
                className="bg-gray-50 text-gray-500 font-semibold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Location (Coordinates)</label>
              <Input 
                placeholder="lat, lng" 
                value={newBin.location}
                onChange={(e) => setNewBin({...newBin, location: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Zone</label>
              <Input 
                type="number"
                min="1"
                placeholder="e.g. 1" 
                value={newBin.zone}
                onChange={(e) => setNewBin({...newBin, zone: e.target.value})}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Type</label>
              <Select 
                value={newBin.type} 
                onValueChange={(val) => setNewBin({...newBin, type: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 99999 }}>
                  <SelectItem value="General Waste">General Waste</SelectItem>
                  <SelectItem value="Recyclables">Recyclables</SelectItem>
                  <SelectItem value="Organic Waste">Organic Waste</SelectItem>
                  <SelectItem value="Mixed Waste">Mixed Waste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
              Save Bin
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* SELECTION OVERLAY */}
      {selectionMode && (
        <div style={{ zIndex: 9999 }} className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-700 text-white px-6 py-4 rounded-xl shadow-2xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 min-w-[500px]">
          <div className="flex justify-between items-center border-b border-white/20 pb-2">
            <span className="font-semibold text-base">Selecting Bins: {selectedBins.length} selected</span>
            <button
              onClick={() => {
                setSelectionMode(false);
                clearSelectedBinIcons(selectedBins);
                setSelectedBins([]);
              }}
              className="text-white/70 hover:text-white transition-colors p-1"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-white/80 mb-1 text-xs font-medium">Select Vehicle</label>
              <select
                value={selectedVehicleId}
                onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full rounded border border-white/30 bg-white/15 px-3 py-2 text-white outline-none [&>option]:text-gray-900"
              >
                <option value="">-- Choose Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.vehicleCode} (Cap: {v.capacity || 25})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-white/80 mb-1 text-xs font-medium">Select Driver</label>
              <select
                value={selectedDriverId}
                onChange={e => setSelectedDriverId(e.target.value)}
                className="w-full rounded border border-white/30 bg-white/15 px-3 py-2 text-white outline-none [&>option]:text-gray-900"
              >
                <option value="">-- Choose Driver --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.driverCode} - {d.name || 'Unnamed'}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-white/80 mb-1 text-xs font-medium">Collectors (Select 2 or more)</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto bg-white/5 p-3 rounded border border-white/10">
              {collectors.length === 0 ? (
                <span className="text-white/50 text-xs italic">No collectors available</span>
              ) : (
                collectors.map(c => (
                  <label key={c.empId} className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors border select-none ${selectedCollectorIds.includes(String(c.empId)) ? 'bg-white/30 border-white/50' : 'bg-white/10 border-transparent hover:bg-white/20'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedCollectorIds.includes(String(c.empId))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCollectorIds([...selectedCollectorIds, String(c.empId)]);
                        else setSelectedCollectorIds(selectedCollectorIds.filter(id => id !== String(c.empId)));
                      }}
                    />
                    <span className="text-sm">{c.empName || c.email}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end items-center mt-2">
            <button
              onClick={async () => {
                if (selectedBins.length === 0) {
                  alert("Please select at least one bin");
                  return;
                }
                if (!selectedVehicleId) {
                  alert("Please select a vehicle");
                  return;
                }
                if (!selectedDriverId) {
                  alert("Please select a driver");
                  return;
                }
                if (selectedCollectorIds.length < 2) {
                  alert("Please select at least two collectors");
                  return;
                }

                const vehicle = vehicles.find(v => String(v.id) === selectedVehicleId);
                const capacity = vehicle?.capacity || DEFAULT_VEHICLE_CAPACITY;

                try {
                  const selectedBinIds = selectedBins
                    .map((id) => Number(id))
                    .filter((id) => Number.isFinite(id));

                  const res = await fetch(ROUTE_SESSION_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: getCurrentUserId(),
                      vehicleCount: 1,
                      vehicleCapacities: [capacity],
                      depotLat: DEPOT_LAT,
                      depotLng: DEPOT_LNG,
                      selectedBinIds,
                      vehicleId: Number(selectedVehicleId),
                      driverId: Number(selectedDriverId),
                      collectorIds: selectedCollectorIds.map(Number)
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

                  // Exit selection mode
                  setSelectionMode(false);
                  clearSelectedBinIcons(selectedBins);
                  setSelectedBins([]);
                } catch (e) {
                  console.error(e);
                  alert("Error generating routes");
                }
              }}
              className="px-6 py-2 bg-green-500 hover:bg-green-400 text-white font-semibold rounded shadow transition-colors"
            >
              Generate Route
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

      {/* SHOW ASSIGNED ROUTES BUTTON */}
      <button
        style={{ zIndex: 9999 }}
        onClick={handleToggleAssignedRoutes}
        className={`absolute top-28 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-md transition-all duration-200 active:scale-95 ${showAssignedRouteMenu
          ? "bg-gray-800 hover:bg-gray-900 text-white hover:shadow-lg"
          : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg"
          }`}
      >
        <Route className="w-4 h-4" />
        Assigned Routes
      </button>

      {/* ASSIGNED ROUTES DROPDOWN */}
      {showAssignedRouteMenu && (
        <div style={{ zIndex: 9999 }} className="absolute top-40 right-4 z-[2000] bg-white rounded-xl shadow-xl border border-gray-100 w-72 overflow-hidden flex flex-col max-h-64 overflow-y-auto">
          {loadingRoutes ? (
            <div className="p-4 text-sm text-gray-500 text-center">Loading routes...</div>
          ) : assignedRoutes.length === 0 ? (
            <div className="p-4 text-sm text-gray-500 text-center">No assigned routes found.</div>
          ) : (
            assignedRoutes.map((r, i) => (
              <button
                key={r.sessionId || r.id || i}
                onClick={async () => {
                  setShowAssignedRouteMenu(false);
                  clearRouteVisualization();

                  try {
                    const res = await fetch(
                      `${API_ORIGIN}/api/route-sessions/${r.sessionId}/routes`,
                      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
                    );
                    if (!res.ok) throw new Error('Failed to fetch route');

                    const vehicleRoutes = await res.json();

                    // Build a snapshot shape compatible with visualizeRoutes()
                    const fakeSnapshot: RouteSessionSnapshot = {
                      sessionId: r.sessionId,
                      userId: 0,
                      version: 0,
                      status: 'READY',
                      trigger: 'ASSIGNED_ROUTES',
                      selectedBinIds: [],
                      addedBinIds: [],
                      removedBinIds: [],
                      route: {
                        totalVehiclesUsed: vehicleRoutes.length,
                        routes: Object.fromEntries(
                          vehicleRoutes.map((vr: any, idx: number) => [
                            String(idx),
                            {
                              vehicleId: idx,
                              capacity: vr.capacity,
                              totalBins: vr.totalBins,
                              estimatedDurationSeconds: vr.estimatedDurationSeconds,
                              binSequence: (vr.binStops ?? []).map((s: any) => ({
                                stopOrder: s.stopOrder,
                                binId: s.binId,
                                lat: s.lat,
                                lng: s.lng,
                                durationFromPrevStopSeconds: s.durationFromPrevSeconds,
                              }))
                            }
                          ])
                        )
                      },
                      message: null
                    };

                    await visualizeRoutes(fakeSnapshot);
                  } catch (e) {
                    console.error('Failed to visualize assigned route', e);
                  }
                }}
                className="flex items-start text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-100 group"
              >
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200 group-hover:text-indigo-700 transition-colors shrink-0">
                  <Route className="w-5 h-5" />
                </div>
                <div className="ml-3 min-w-0">
                  <span className="block font-semibold text-gray-800 text-sm truncate">Route #{r.id || i + 1}</span>
                  <span className="block text-xs text-gray-500 mt-0.5 truncate">Vehicle: {r.vehicleCode || 'N/A'}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* DROPDOWN */}
      {showRouteMenu && (
        <div style={{ zIndex: 9999 }} className="absolute top-16 right-40 z-[2000] bg-white rounded-xl shadow-xl border border-gray-100 w-72 overflow-hidden flex flex-col">
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
            <label className="text-xs text-gray-700 font-medium block mb-1">Zone (Number)</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 1"
              className="w-full text-sm border border-gray-200 rounded p-1.5 bg-gray-50 focus:ring focus:ring-blue-200 focus:border-blue-400 outline-none"
              value={markers.get(contextMenu.binId)?.data.zone || ''}
              onBlur={(e) => updateZone(contextMenu.binId, e.target.value)}
              onChange={(e) => updateBinLocally(contextMenu.binId, { zone: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateZone(contextMenu.binId, e.currentTarget.value);
                  setContextMenu(null);
                }
              }}
            />
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