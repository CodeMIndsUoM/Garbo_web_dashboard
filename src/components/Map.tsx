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

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081'; // Base URL for all API calls; overridable via env
const BINS_API = `${API_ORIGIN}/api/bins`; // REST endpoint for bin CRUD operations
const ROUTE_SESSION_API = `${API_ORIGIN}/api/route-sessions`; // REST endpoint for route session management
const DEFAULT_VEHICLE_CAPACITY = 25; // Fallback capacity when vehicle data is unavailable
const ROUTE_COLORS = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#db2777', '#0891b2']; // Distinct colors cycled per vehicle route

// Small orange circle icon for unselected bins on the map
const binIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;background-color:#f97316;border:2px solid white;border-radius:50%;box-shadow:0 3px 6px rgba(0,0,0,0.35);"></div>`,
  className: '', iconSize: [16, 16], iconAnchor: [8, 8],
});

// Larger purple square icon representing the central depot/start point
const depotIcon = L.divIcon({
  html: `<div style="width:36px;height:36px;background-color:#9333ea;border:2px solid white;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-4 9 4v13"></path><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"></path></svg></div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 36],
});

// Green checkmark icon applied to bins that have been selected for routing
const selectedBinIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;background-color:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 4px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`,
  className: '', iconSize: [24, 24], iconAnchor: [12, 12],
});

// Maps bin fill status strings to their corresponding indicator colors
const STATUS_COLOR_MAP: Record<string, string> = {
  full: '#ef4444',       // Red — bin needs immediate collection
  half: '#f59e0b',       // Amber — bin is partially filled
  empty: '#10b981',      // Green — bin has been emptied
  not_checked: '#94a3b8' // Grey — bin status is unknown
};


// In-memory icon cache keyed by status to avoid recreating identical Leaflet DivIcon objects
const statusIconCache = new Map<string, L.DivIcon>();
const getStatusIcon = (status?: string) => {
  const key = (status || 'not_checked').toLowerCase(); // Normalise to lowercase for consistent cache lookups
  if (statusIconCache.has(key)) return statusIconCache.get(key)!; // Return cached instance if available
  const color = STATUS_COLOR_MAP[key] || STATUS_COLOR_MAP['not_checked']; // Fall back to grey for unrecognised statuses
  const icon = L.divIcon({
    html: `<div style="width:16px;height:16px;background-color:${color};border:2px solid white;border-radius:50%;box-shadow:0 3px 6px rgba(0,0,0,0.35);"></div>`,
    className: '', iconSize: [16, 16], iconAnchor: [8, 8],
  });
  statusIconCache.set(key, icon); // Cache the newly created icon for future reuse
  return icon;
};

// Retrieves the JWT from localStorage and constructs Authorization headers for authenticated API calls
const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
};

interface BinData {
  id: string;
  lat: number;
  lng: number;
  fillLevel: number;
  status?: 'full' | 'half' | 'empty' | 'not_checked';
  priority: 'low' | 'medium' | 'high';
  zone: string;
  binCode?: string;
}

interface RouteBinStop {
  stopOrder: number;
  binId: number;
  lat: number;
  lng: number;
  durationFromPrevStopSeconds: number; // Travel time in seconds from the previous stop
}

interface VehicleRoute {
  vehicleId: number;
  capacity: number;
  totalBins: number;
  estimatedDurationSeconds: number; // Total estimated route duration for this vehicle
  binSequence: RouteBinStop[];
}

interface RouteResponse {
  totalVehiclesUsed: number;
  routes: Record<string, VehicleRoute>; // Keyed by vehicle identifier string
}

interface RouteSessionSnapshot {
  sessionId: string;
  userId: number;
  version: number;
  status: 'PROCESSING' | 'READY' | 'ERROR' | 'SESSION_CREATED'; // Lifecycle states pushed via WebSocket
  trigger: string;
  selectedBinIds: number[];
  addedBinIds: number[];
  removedBinIds: number[];
  route: RouteResponse | null; // Null while the session is still processing
  message: string | null;     // Human-readable error or status message from the server
}

interface CouncilBoundaryDTO {
  council:        string;
  depotLat:       number;
  depotLng:       number;
  boundaryPoints: { lat: number; lng: number }[]; // Ordered polygon vertices defining the municipal boundary
}

type BinMarkersMap = Map<string, { marker: L.Marker; data: BinData }>; // Maps bin ID → Leaflet marker + domain data

export default function MapView({ council }: { council?: { name?: string } | null }) {

  const mapRef           = useRef<HTMLDivElement | null>(null);   // DOM node that Leaflet mounts into
  const leafletMapRef    = useRef<L.Map | null>(null);            // Leaflet map instance; null before initialisation
  const addModeRef       = useRef(false);                         // Ref mirror of addMode — readable inside map event closures without stale state
  const routeLayerRef    = useRef<L.FeatureGroup | null>(null);   // FeatureGroup holding all route polylines; cleared between optimisations
  const stompClientRef   = useRef<Client | null>(null);           // Active STOMP client for the route WebSocket subscription
  const depotMarkerRef   = useRef<L.Marker | null>(null);         // Reference to the depot marker for potential repositioning
  const turfPolyRef      = useRef<ReturnType<typeof turfPolygon> | null>(null); // Turf polygon used for point-in-polygon boundary checks

  // Council boundary state
  const [boundaryData, setBoundaryData] = useState<CouncilBoundaryDTO | null>(null); // API response for the council's boundary + depot
  const [boundaryLoading, setBoundaryLoading] = useState(true); // Prevents map initialisation before boundary is resolved

  const [markers, setMarkers]                   = useState<BinMarkersMap>(new Map()); // All rendered bin markers indexed by bin ID
  const [addMode, setAddMode]                   = useState(false); // When true, map clicks trigger new-bin placement
  const [contextMenu, setContextMenu]           = useState<{ x: number, y: number, binId: string } | null>(null); // Right-click context menu state for a specific bin
  const [showRouteMenu, setShowRouteMenu]       = useState(false); // Controls visibility of the "Create Route" dropdown
  const [showAssignedRouteMenu, setShowAssignedRouteMenu] = useState(false); // Controls visibility of the assigned routes dropdown
  const [assignedRoutes, setAssignedRoutes]     = useState<any[]>([]); // Routes previously assigned to the current user
  const [loadingRoutes, setLoadingRoutes]       = useState(false); // Loading indicator for the assigned routes fetch
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false); // Controls the new-bin creation dialog
  const [newBin, setNewBin]                     = useState({ location: '', type: 'General Waste', zone: '' }); // Form state for the new bin dialog

  const [selectionMode, setSelectionMode]       = useState(false); // When true, map markers are tappable for route bin selection
  const [selectedBins, setSelectedBins]         = useState<string[]>([]); // IDs of bins chosen for the next route optimisation
  const [activeSessionId, setActiveSessionId]   = useState<string | null>(null); // WebSocket session being monitored
  const [routeStatus, setRouteStatus]           = useState<string>(''); // Latest status string received from the WebSocket
  const [routeError, setRouteError]             = useState<string>(''); // Error message displayed in the status banner
  const [vehicles, setVehicles]                 = useState<any[]>([]); // Available vehicles fetched for the route form
  const [drivers, setDrivers]                   = useState<any[]>([]); // Available drivers fetched for the route form
  const [collectors, setCollectors]             = useState<any[]>([]); // Available collectors fetched for the route form
  const [selectedVehicleId, setSelectedVehicleId]   = useState<string>(''); // Selected vehicle ID in the route setup panel
  const [selectedDriverId, setSelectedDriverId]     = useState<string>(''); // Selected driver ID in the route setup panel
  const [selectedCollectorIds, setSelectedCollectorIds] = useState<string[]>([]); // Multi-selected collector IDs
  const selectionModeRef = useRef(false); // Ref mirror of selectionMode — used inside Leaflet click closures

  // ── Fetch council boundary from API ────────────────────────────────────────
  useEffect(() => {
    if (!council?.name) {
      setBoundaryLoading(false); // No council context; skip fetch and proceed with defaults
      return;
    }

    const fetchBoundary = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await fetch(
          `${API_ORIGIN}/api/council-boundaries?council=${encodeURIComponent(council.name!)}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Boundary fetch failed: ${res.status}`);
        const data: CouncilBoundaryDTO = await res.json();
        setBoundaryData(data); // Store boundary + depot coords for later map initialisation
      } catch (err) {
        console.error('Failed to fetch council boundary', err);
      } finally {
        setBoundaryLoading(false); // Always unblock map initialisation regardless of success/failure
      }
    };

    fetchBoundary();
  }, [council?.name]); // Re-fetch if the council changes (e.g., admin switching councils)

  // Derives the next sequential bin code for this council, e.g. "Moratuwa-42"
  const nextBinCode = useMemo(() => {
    if (!council?.name) return 'Auto-generated';
    const prefix = `${council.name.trim()}-`.toLowerCase(); // Normalised prefix for matching existing codes
    let maxNumber = 0;
    markers.forEach((entry) => {
      const code = entry.data.binCode?.toLowerCase() || '';
      if (code.startsWith(prefix)) {
        const numStr = code.slice(prefix.length).trim();
        if (/^\d+$/.test(numStr)) {
          maxNumber = Math.max(maxNumber, parseInt(numStr, 10)); // Track the highest numeric suffix seen
        }
      }
    });
    return `${council.name.trim()}-${maxNumber + 1}`; // Increment by one for the new bin
  }, [council, markers]); // Recompute whenever the council or the set of markers changes

  // Keep refs in sync with their corresponding state values so Leaflet closures always read current values
  useEffect(() => { addModeRef.current = addMode; }, [addMode]);
  useEffect(() => { selectionModeRef.current = selectionMode; }, [selectionMode]);

  // Fetches vehicles, drivers, and collectors whenever selection mode opens or the council changes
  useEffect(() => {
    const fetchResources = async () => {
      const token = localStorage.getItem('token');
      const authHeaders = (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
      const councilQuery = council?.name ? `?council=${encodeURIComponent(council.name)}` : ''; // Scope resources to the active council
      try {
        const [vehRes, drvRes, usrRes] = await Promise.all([
          fetch(`${API_ORIGIN}/api/route-sessions/available-vehicles${councilQuery}`, { headers: authHeaders }),
          fetch(`${API_ORIGIN}/api/route-sessions/available-drivers${councilQuery}`,  { headers: authHeaders }),
          fetch(`${API_ORIGIN}/api/route-sessions/available-collectors${councilQuery}`, { headers: authHeaders })
        ]);
        if (vehRes.ok) { const j = await vehRes.json(); if (j.success) setVehicles(j.data); }
        if (drvRes.ok) { const j = await drvRes.json(); if (j.success) setDrivers(j.data); }
        if (usrRes.ok) { const j = await usrRes.json(); if (j.data) setCollectors(j.data); }
      } catch (e) { console.error('Failed to fetch routing resources', e); }
    };
    fetchResources();
  }, [selectionMode, council?.name]);

  // Toggles a bin's selection state and swaps its marker icon between status-based and the green checkmark
  const toggleBinSelection = (id: string) => {
    setSelectedBins(prev => {
      const isSelected = prev.includes(id);
      const newSelected = isSelected ? prev.filter(b => b !== id) : [...prev, id];
      setMarkers(currentMarkers => {
        const m = new Map(currentMarkers);
        const entry = m.get(id);
        if (entry) {
          // Revert to fill-status icon if deselecting, otherwise apply the selection checkmark
          entry.marker.setIcon(isSelected ? getStatusIcon(entry.data.status) : selectedBinIcon);
        }
        return m;
      });
      return newSelected;
    });
  };

  // Restores the fill-status icon for every previously selected bin when exiting selection mode
  const clearSelectedBinIcons = (ids: string[]) => {
    ids.forEach(id => {
      const entry = markers.get(id);
      if (entry) entry.marker.setIcon(getStatusIcon(entry.data.status));
    });
  };

  // Removes all route polylines from the map without affecting bin markers
  const clearRouteVisualization = () => {
    if (routeLayerRef.current) routeLayerRef.current.clearLayers();
  };

  // Extracts the current user's ID from the persisted admin object in localStorage
  const getCurrentUserId = () => {
    if (typeof window === 'undefined') return 1; // SSR safety — default to a placeholder ID
    const raw = localStorage.getItem('admin');
    if (!raw) return 1;
    try {
      const admin = JSON.parse(raw);
      const idCandidate = Number(admin?.id ?? admin?.userId);
      return Number.isFinite(idCandidate) && idCandidate > 0 ? idCandidate : 1; // Guard against NaN or negative IDs
    } catch { return 1; }
  };

  // Builds a road-snapped polyline for one vehicle's stops using OSRM, falling back to straight lines on failure
  const buildRoadPolyline = async (stops: RouteBinStop[], color: string, vehicleId: string) => {
    if (!routeLayerRef.current || !leafletMapRef.current || stops.length === 0) return;

    // Use council-specific depot coordinates if available, otherwise fall back to Moratuwa defaults
    const depotLat = boundaryData?.depotLat ?? 6.775080;
    const depotLng = boundaryData?.depotLng ?? 79.882289;

    // Route starts and ends at the depot, with bin stops in between
    const pathCoordinates: [number, number][] = [
      [depotLat, depotLng],
      ...stops.map(stop => [stop.lat, stop.lng] as [number, number]),
      [depotLat, depotLng] // Return to depot at the end of the route
    ];

    // OSRM expects coordinates as lng,lat pairs in the URL
    const osrmCoordString = pathCoordinates.map(([lat, lng]) => `${lng},${lat}`).join(';');

    try {
      const osrmRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${osrmCoordString}?overview=full&geometries=geojson`
      );
      if (!osrmRes.ok) throw new Error(`OSRM failed for vehicle ${vehicleId}`);
      const osrmJson = await osrmRes.json();
      const coords = osrmJson?.routes?.[0]?.geometry?.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length === 0) throw new Error('No geometry from OSRM');
      const latLngs: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]); // Convert GeoJSON [lng,lat] → Leaflet [lat,lng]
      L.polyline(latLngs, { color, weight: 5, opacity: 0.85 })
        .bindTooltip(`Vehicle ${vehicleId}`)
        .addTo(routeLayerRef.current);
    } catch {
      // Fallback: draw a straight-line polyline with a dashed style to indicate it's approximate
      L.polyline(pathCoordinates, { color, weight: 3, opacity: 0.6, dashArray: '8, 6' })
        .bindTooltip(`Vehicle ${vehicleId} (fallback)`)
        .addTo(routeLayerRef.current);
    }
  };

  // Public-facing wrapper that always clears existing routes before drawing the new snapshot
  const visualizeRoutes = async (snapshot: RouteSessionSnapshot) => {
    await visualizeRoutesInternal(snapshot, true);
  };

  // Core visualisation logic; `clear` flag allows incremental drawing when loading multiple sessions
  const visualizeRoutesInternal = async (snapshot: RouteSessionSnapshot, clear = true) => {
    if (!leafletMapRef.current || !snapshot.route?.routes) return;
    if (clear) clearRouteVisualization();
    const routeEntries = Object.entries(snapshot.route.routes);
    // Draw all vehicle polylines in parallel for faster rendering
    await Promise.all(routeEntries.map(async ([vehicleKey, vehicleRoute], index) => {
      const color = ROUTE_COLORS[index % ROUTE_COLORS.length]; // Cycle through the colour palette
      await buildRoadPolyline(vehicleRoute.binSequence || [], color, vehicleKey);
    }));
    if (routeLayerRef.current) {
      const bounds = routeLayerRef.current.getBounds();
      if (bounds.isValid()) leafletMapRef.current.fitBounds(bounds.pad(0.15)); // Pan + zoom to show all routes with padding
    }
  };

  // Gracefully terminates the active STOMP WebSocket connection
  const disconnectRouteSocket = () => {
    if (stompClientRef.current) {
      stompClientRef.current.deactivate();
      stompClientRef.current = null;
    }
  };

  // Opens a STOMP WebSocket subscription for real-time route-session status updates
  const connectRouteSocket = (sessionId: string) => {
    disconnectRouteSocket(); // Ensure no stale connection exists before opening a new one
    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_ORIGIN}/ws`),
      reconnectDelay: 2000, // Automatically attempt reconnection after 2 seconds on drop
      debug: () => {}       // Suppress verbose STOMP debug output in production
    });
    client.onConnect = () => {
      client.subscribe(`/topic/route-sessions/${sessionId}`, async (message) => {
        try {
          const snapshot = JSON.parse(message.body) as RouteSessionSnapshot;
          setActiveSessionId(snapshot.sessionId);
          setRouteStatus(snapshot.status || '');
          if (snapshot.status === 'ERROR') {
            setRouteError(snapshot.message || 'Route optimization failed');
            return; // Stop processing; error banner will display the message
          }
          if (snapshot.status === 'READY') {
            setRouteError(''); // Clear any previous error before drawing the new routes
            await visualizeRoutes(snapshot);
          }
        } catch (error) { console.error('Failed to parse websocket route snapshot', error); }
      });
    };
    client.onStompError = (frame) => { setRouteError(frame.headers['message'] || 'Websocket broker error'); };
    client.onWebSocketError = () => { setRouteError('Websocket connection error'); };
    client.activate();
    stompClientRef.current = client; // Persist client reference for later cleanup
  };

  // ── MAP INIT — wait for boundary data ─────────────────────────────────────
  useEffect(() => {
    if (boundaryLoading) return; // Defer until boundary API response is resolved
    if (mapRef.current && leafletMapRef.current) return; // Prevent double-initialisation (React StrictMode)
    if (!mapRef.current) return;

    // Use boundary from API or fall back to Moratuwa defaults
    const municipalCoords: [number, number][] = boundaryData?.boundaryPoints?.length
      ? boundaryData.boundaryPoints.map(p => [p.lat, p.lng])
      : [
          [6.811952, 79.867387],
          [6.82722,  79.93127],
          [6.76338,  79.9669],
          [6.716461, 79.901547],
        ];

    const depotLat = boundaryData?.depotLat ?? 6.775080;
    const depotLng = boundaryData?.depotLng ?? 79.882289;

    // Build a Turf polygon (GeoJSON) for point-in-polygon checks when placing new bins
    const coords = municipalCoords.map(([lat, lng]) => [lng, lat]); // Turf uses [lng, lat] order
    coords.push(coords[0]); // Close the ring as required by the GeoJSON Polygon spec
    turfPolyRef.current = turfPolygon([coords]);

    const leafletPoly = L.polygon(municipalCoords);
    const bounds = leafletPoly.getBounds();

    const map = L.map(mapRef.current, {
      maxBounds: bounds,           // Prevent panning outside the municipal area
      maxBoundsViscosity: 1.0,    // Hard boundary — map snaps back immediately on drag out
      zoomControl: false           // Zoom controls omitted; custom controls can be added separately
    });

    map.fitBounds(bounds);
    map.setMinZoom(map.getZoom()); // Lock minimum zoom to the initial fit-bounds level
    map.setMaxZoom(18);
    leafletMapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { noWrap: true }).addTo(map);

    // Draw the municipal boundary as a thin blue outline with no fill
    leafletPoly.addTo(map).setStyle({ color: "#2563eb", weight: 2, fillOpacity: 0 });

    // Overlay the entire world with an opaque white mask, leaving only the municipal polygon visible
    const world: [number, number][] = [[-90, -180], [-90, 180], [90, 180], [90, -180]];
    L.polygon([world, municipalCoords], {
      color: "transparent", fillColor: "#ffffff", fillOpacity: 1.0, interactive: false // Non-interactive so clicks pass through to the map
    }).addTo(map);

    // Place depot marker at council-specific location
    const dm = L.marker([depotLat, depotLng], { icon: depotIcon }).addTo(map);
    dm.bindTooltip("<div class='font-bold text-sm'>Central Depot</div>", {
      direction: 'top', permanent: false, offset: [0, -10]
    });
    depotMarkerRef.current = dm;

    map.on('click', (e: L.LeafletMouseEvent) => {
      setContextMenu(null); // Dismiss any open context menu on map click
      if (!addModeRef.current) return; // Ignore clicks when not in add mode
      const pt = point([e.latlng.lng, e.latlng.lat]); // Turf point uses [lng, lat]
      if (!turfPolyRef.current || !booleanPointInPolygon(pt, turfPolyRef.current)) {
        alert("Outside municipal area!"); // Reject clicks outside the boundary
        return;
      }
      // Pre-populate the form with the clicked coordinates and open the creation dialog
      setNewBin(prev => ({ ...prev, location: `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}` }));
      setIsCreateModalOpen(true);
      setAddMode(false); // Exit add mode after capturing a location
    });

    loadBins();          // Fetch and render existing bins from the API
    loadActiveSession(); // Restore any previously active route session for this user
    routeLayerRef.current = L.featureGroup().addTo(map); // Initialise the layer group that holds route polylines

    return () => {
      disconnectRouteSocket(); // Clean up WebSocket on component unmount
      if (routeLayerRef.current) routeLayerRef.current.clearLayers();
    };
  }, [boundaryLoading, boundaryData]);

  // ── LOAD BINS ────────────────────────────────────────────────────────────
  const loadBins = async () => {
    const res = await fetch(BINS_API);
    if (!res.ok) { console.error(`Failed to load bins: ${res.status}`); return; }
    const payload = await res.json();
    let bins: any[] = [];
    // Normalise various API response shapes (array, {data:[]}, {value:[]}) into a flat array
    if (Array.isArray(payload)) bins = payload;
    else if (payload?.data && Array.isArray(payload.data)) bins = payload.data;
    else if (payload?.value && Array.isArray(payload.value)) bins = payload.value;

    bins.forEach((bin: any) => {
      const lat = Number(bin.lat ?? bin.latitude);   // Support both short and long field names
      const lng = Number(bin.lng ?? bin.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return; // Skip bins with invalid coordinates
      addMarker({
        id: String(bin.id), binCode: bin.binCode,
        lat, lng, fillLevel: bin.fillLevel,
        priority: bin.priority || 'medium',
        zone: bin.zone || 'unassigned',
        status: bin.status || 'not_checked'
      });
    });
  };

  // Builds the HTML tooltip content shown when hovering over a bin marker
  const renderTooltip = (d: BinData) => {
    const statusLabel = d.status === 'full' ? 'Full' : d.status === 'half' ? 'Half' :
                        d.status === 'empty' ? 'Empty' : 'Not Checked';
    return `<div>
      <strong>Code:</strong> ${d.binCode || d.id}<br/>
      <strong>Fill Status:</strong> ${statusLabel}<br/>
      <strong>Priority:</strong> ${d.priority}<br/>
      <strong>Zone:</strong> ${d.zone}
    </div>`;
  };

  // Creates and registers a Leaflet marker for a bin, wiring up click and context-menu handlers
  const addMarker = (data: BinData) => {
    if (!leafletMapRef.current) return;
    const marker = L.marker([data.lat, data.lng], { icon: getStatusIcon(data.status) })
      .addTo(leafletMapRef.current);
    marker.bindTooltip(renderTooltip(data));
    marker.on('click', () => { if (selectionModeRef.current) toggleBinSelection(data.id); }); // Only toggle selection when in selection mode
    marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
      const pt = leafletMapRef.current!.latLngToContainerPoint(e.latlng); // Convert geo coords to pixel coords for positioning the context menu
      setContextMenu({ x: pt.x, y: pt.y, binId: data.id });
    });
    setMarkers(prev => { const m = new Map(prev); m.set(data.id, { marker, data }); return m; });
  };

  // Handles form submission for the new-bin creation dialog
  const handleCreateBinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(BINS_API, {
        method: "POST", headers,
        body: JSON.stringify({ location: newBin.location, type: newBin.type, zone: newBin.zone, fillLevel: 0, priority: 'medium', status: 'empty' })
      });
      if (!res.ok) {
        let errMessage = 'Failed to create bin';
        try { const errData = await res.json(); errMessage = errData.message || errMessage; } catch(e) {}
        throw new Error(errMessage);
      }
      const responseData = await res.json();
      const saved = responseData.data || responseData; // Unwrap the response envelope if present
      addMarker({
        id: String(saved.id), binCode: saved.binCode,
        lat: saved.lat || saved.latitude, lng: saved.lng || saved.longitude,
        fillLevel: saved.fillLevel || 0,
        priority: saved.priority || 'medium',
        zone: saved.zone || newBin.zone,
        status: saved.status || 'not_checked'
      });
      setIsCreateModalOpen(false);
      setNewBin({ location: '', type: 'General Waste', zone: '' }); // Reset form for the next entry
    } catch(err) {
      const e = err as Error;
      alert(e.message || "Error creating bin");
    }
  };

  // Sends a DELETE request for the given bin and removes its marker from the map
  const removeBin = async (id: string) => {
    const res = await fetch(`${BINS_API}/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    if (!res.ok) { console.error(`Failed to delete bin ${id}`); return; }
    const entry = markers.get(id);
    if (entry && leafletMapRef.current) leafletMapRef.current.removeLayer(entry.marker);
    setMarkers(prev => { const m = new Map(prev); m.delete(id); return m; });
    setContextMenu(null); // Dismiss the context menu after deletion
  };

  // Applies partial updates to a bin's in-memory data and refreshes its tooltip; avoids a full reload
  const updateBinLocally = (id: string, updates: Partial<BinData>) => {
    const entry = markers.get(id);
    if (!entry) return;
    const newData = { ...entry.data, ...updates };
    entry.data = newData;
    entry.marker.bindTooltip(renderTooltip(newData)); // Reflect updated fields in the hover tooltip
    const isSelected = selectedBins.includes(id);
    if (!isSelected) entry.marker.setIcon(getStatusIcon(newData.status)); // Preserve selection icon if the bin is currently selected
    setMarkers(new Map(markers));
  };

  // PUTs the new priority value to the API and updates the local marker on success
  const updatePriority = async (id: string, priority: BinData['priority']) => {
    try {
      const res = await fetch(`${BINS_API}/${id}/priority?priority=${encodeURIComponent(priority)}`,
        { method: "PUT", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Priority update failed: ${res.status}`);
      updateBinLocally(id, { priority });
    } catch (e) { console.error("Failed to update priority", e); }
  };

  // PUTs the new zone value to the API and updates the local marker on success
  const updateZone = async (id: string, zone: string) => {
    try {
      const res = await fetch(`${BINS_API}/${id}/zone?zone=${encodeURIComponent(zone)}`,
        { method: "PUT", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Zone update failed: ${res.status}`);
      updateBinLocally(id, { zone });
    } catch (e) { console.error("Failed to update zone", e); }
  };

  // Activates bin selection mode and resets all related UI state
  const handleSelectBins = () => {
    setSelectionMode(true); setSelectedBins([]);
    clearRouteVisualization(); setRouteError(''); setRouteStatus('');
    setAddMode(false); setShowRouteMenu(false); // Ensure conflicting modes are disabled
  };

  const handleOptimizeZone = async () => {
    alert("Trigger route optimization for zones"); // Placeholder — zone-based optimisation not yet implemented
    setShowRouteMenu(false);
  };

  // Toggles the assigned routes dropdown; lazy-loads routes from the API on first open
  const handleToggleAssignedRoutes = async () => {
    setShowAssignedRouteMenu(!showAssignedRouteMenu);
    if (!showAssignedRouteMenu && assignedRoutes.length === 0) {
      setLoadingRoutes(true);
      try {
        const userId = getCurrentUserId();
        const res = await fetch(`${API_ORIGIN}/api/route-sessions/user/${userId}/active`,
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        if (res.ok) {
          const json = await res.json();
          setAssignedRoutes(Array.isArray(json) ? json : (json.data || []));
        }
      } catch (e) { console.error('Failed to fetch assigned routes', e); }
      finally { setLoadingRoutes(false); }
    }
  };

  // Restores any active route session for the current user on initial map load
  const loadActiveSession = async () => {
    try {
      const userId = getCurrentUserId();
      const res = await fetch(`${API_ORIGIN}/api/route-sessions/user/${userId}/active`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.ok) {
        const json = await res.json();
        const assignments = Array.isArray(json) ? json : (json.data || []);
        if (assignments.length > 0) {
          setRouteStatus('READY');
          clearRouteVisualization(); // Clear stale routes before drawing the restored ones
          for (const assignment of assignments) {
            try {
              const routeRes = await fetch(`${API_ORIGIN}/api/route-sessions/${assignment.sessionId}/routes`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
              if (routeRes.ok) {
                const vRoutes = await routeRes.json();
                const vehicleRoutes = Array.isArray(vRoutes) ? vRoutes : (vRoutes.data || []);
                // Reconstruct a RouteSessionSnapshot from the persisted assignment data for reuse by visualizeRoutesInternal
                const fakeSnapshot: RouteSessionSnapshot = {
                  sessionId: assignment.sessionId, userId,
                  version: 0, status: 'READY', trigger: 'INITIAL_LOAD',
                  selectedBinIds: [], addedBinIds: [], removedBinIds: [],
                  route: {
                    totalVehiclesUsed: vehicleRoutes.length,
                    routes: Object.fromEntries(vehicleRoutes.map((vr: any, idx: number) => [
                      vr.vehicleId ? String(vr.vehicleId) : `v-${assignment.id}-${idx}`, // Generate a stable key if vehicleId is absent
                      {
                        vehicleId: vr.vehicleId || idx,
                        capacity: vr.capacity, totalBins: vr.totalBins,
                        estimatedDurationSeconds: vr.estimatedDurationSeconds,
                        binSequence: (vr.binStops ?? []).map((s: any) => ({
                          stopOrder: s.stopOrder, binId: s.binId,
                          lat: s.lat, lng: s.lng,
                          durationFromPrevStopSeconds: s.durationFromPrevSeconds, // Map API field name to interface field name
                        }))
                      }
                    ]))
                  },
                  message: null
                };
                await visualizeRoutesInternal(fakeSnapshot, false); // false = don't clear; accumulate multiple session routes
              }
              if (assignment === assignments[0]) {
                // Subscribe to real-time updates only for the first (most recent) session
                setActiveSessionId(assignment.sessionId);
                connectRouteSocket(assignment.sessionId);
              }
            } catch (err) { console.error('Error loading assignment', assignment, err); }
          }
        }
      }
    } catch (e) { console.error('Failed to load active session on mount', e); }
  };

  // Show loading while fetching boundary
  if (boundaryLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          <p className="text-gray-500 text-sm font-medium">Loading map...</p>
        </div>
      </div>
    );
  }

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
              <label className="text-sm font-medium text-gray-700">Bin Code</label>
              <Input value={nextBinCode} disabled className="bg-gray-50 text-gray-500 font-semibold" /> {/* Auto-generated; not user-editable */}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Location (Coordinates)</label>
              <Input placeholder="lat, lng" value={newBin.location}
                onChange={(e) => setNewBin({...newBin, location: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Zone</label>
              <Input type="number" min="1" placeholder="e.g. 1" value={newBin.zone}
                onChange={(e) => setNewBin({...newBin, zone: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Type</label>
              <Select value={newBin.type} onValueChange={(val) => setNewBin({...newBin, type: val})}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent style={{ zIndex: 99999 }}> {/* High z-index ensures the dropdown renders above the Leaflet map */}
                  <SelectItem value="General Waste">General Waste</SelectItem>
                  <SelectItem value="Recyclables">Recyclables</SelectItem>
                  <SelectItem value="Organic Waste">Organic Waste</SelectItem>
                  <SelectItem value="Mixed Waste">Mixed Waste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Bin</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* SELECTION OVERLAY */}
      {selectionMode && (
        <div style={{ zIndex: 9999 }} className="absolute top-40 right-4 w-[350px] max-h-[calc(100vh-180px)] bg-white text-gray-800 p-5 rounded-xl shadow-xl flex flex-col gap-5 animate-in fade-in slide-in-from-right-8 duration-300 border border-gray-100 overflow-hidden">
          <div className="flex items-center border-b border-gray-100 pb-4 shrink-0">
            <button onClick={() => { setSelectionMode(false); clearSelectedBinIcons(selectedBins); setSelectedBins([]); }} // Cancel selection and restore all marker icons
              className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 mr-3 rounded-md hover:bg-gray-100" title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
            <span className="font-semibold text-lg tracking-wide flex-1">Route Setup</span>
            <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">{selectedBins.length} bins</span> {/* Live count of selected bins */}
          </div>

          <div className="flex flex-col gap-4 text-sm shrink-0">
            <div>
              <label className="block text-gray-500 mb-1.5 text-xs font-semibold uppercase tracking-wider">Select Vehicle</label>
              <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">-- Choose Vehicle --</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.licensePlate || v.vehicleCode} (Cap: {v.capacity || 25})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-gray-500 mb-1.5 text-xs font-semibold uppercase tracking-wider">Select Driver</label>
              <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                <option value="">-- Choose Driver --</option>
                {drivers.map(d => <option key={d.empId} value={d.empId}>{d.empName || 'Unnamed'}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <label className="block text-gray-500 mb-2 text-xs font-semibold uppercase tracking-wider shrink-0">Collectors (Select 2+)</label>
            <div className="flex flex-col gap-2 overflow-y-auto p-1 -mx-1 flex-1">
              {collectors.length === 0 ? (
                <span className="text-gray-500 text-xs italic px-2">No collectors available</span>
              ) : (
                collectors.map(c => (
                  <label key={c.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border select-none w-full ${selectedCollectorIds.includes(String(c.id)) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedCollectorIds.includes(String(c.id))}
                      onChange={(e) => {
                        // Add or remove the collector ID from the multi-selection list
                        if (e.target.checked) setSelectedCollectorIds([...selectedCollectorIds, String(c.id)]);
                        else setSelectedCollectorIds(selectedCollectorIds.filter(id => id !== String(c.id)));
                      }} />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-gray-100 shrink-0">
            <button
              onClick={async () => {
                // Validate all required fields before submitting the route session request
                if (selectedBins.length === 0) { alert("Please select at least one bin"); return; }
                if (!selectedVehicleId) { alert("Please select a vehicle"); return; }
                if (!selectedDriverId) { alert("Please select a driver"); return; }
                if (selectedCollectorIds.length < 2) { alert("Please select at least two collectors"); return; }
                const vehicle = vehicles.find(v => String(v.id) === selectedVehicleId);
                const capacity = vehicle?.capacity || DEFAULT_VEHICLE_CAPACITY; // Use API capacity or fall back to default
                try {
                  const selectedBinIds = selectedBins.map(id => Number(id)).filter(id => Number.isFinite(id)); // Guard against non-numeric IDs
                  const res = await fetch(ROUTE_SESSION_API, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      userId: getCurrentUserId(), vehicleCount: 1,
                      vehicleCapacities: [capacity],
                      depotLat: boundaryData?.depotLat ?? 6.775080, // Pass council-specific depot to the optimiser
                      depotLng: boundaryData?.depotLng ?? 79.882289,
                      selectedBinIds,
                      vehicleId: Number(selectedVehicleId),
                      driverId: Number(selectedDriverId),
                      collectorIds: selectedCollectorIds.map(Number)
                    })
                  });
                  if (!res.ok) { const errorText = await res.text(); throw new Error(errorText || 'Failed to create route session'); }
                  const snapshot = await res.json() as RouteSessionSnapshot;
                  setRouteStatus(snapshot.status || 'PROCESSING');
                  setRouteError('');
                  setActiveSessionId(snapshot.sessionId);
                  if (snapshot.status === 'READY') await visualizeRoutes(snapshot); // Draw immediately if the server returned synchronously
                  connectRouteSocket(snapshot.sessionId); // Subscribe for async updates if still processing
                  setSelectionMode(false);
                  clearSelectedBinIcons(selectedBins); // Restore normal icons now that selection is complete
                  setSelectedBins([]);
                } catch (e) { console.error(e); alert("Error generating routes"); }
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg transition-colors flex justify-center items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Generate Route
            </button>
          </div>
        </div>
      )}

      {/* Route session status banner — shown whenever a session is active or has errored */}
      {(routeStatus || routeError || activeSessionId) && (
        <div style={{ zIndex: 9999 }} className="absolute bottom-4 left-4 bg-white/95 border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm max-w-sm">
          <div className="font-semibold text-gray-800">Route Session</div>
          {activeSessionId && <div className="text-xs text-gray-500 mt-1">Session: {activeSessionId}</div>}
          {routeStatus && <div className="text-sm mt-1">Status: <span className="font-medium text-blue-700">{routeStatus}</span></div>}
          {routeError && <div className="text-sm mt-1 text-red-600">{routeError}</div>}
        </div>
      )}

      {/* ADD BIN */}
      <button style={{ zIndex: 9999 }} onClick={() => setAddMode(!addMode)}
        className={`absolute top-4 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-md transition-all duration-200 active:scale-95 ${addMode ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg"}`}>
        <Plus className={`w-4 h-4 transition-transform duration-200 ${addMode ? "rotate-45" : ""}`} /> {/* Icon rotates to an ✕ when add mode is active */}
        {addMode ? "Click Map to Add" : "Add Bin"}
      </button>

      {/* CREATE ROUTE BUTTON */}
      <button style={{ zIndex: 9999 }} onClick={() => setShowRouteMenu(!showRouteMenu)}
        className={`absolute top-16 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-md transition-all duration-200 active:scale-95 ${showRouteMenu ? "bg-gray-800 hover:bg-gray-900 text-white" : "bg-green-600 hover:bg-green-700 text-white hover:shadow-lg"}`}>
        <Navigation className={`w-4 h-4 transition-transform duration-200 ${showRouteMenu ? "-rotate-90" : ""}`} /> {/* Icon rotates when the menu is open */}
        Create Route
      </button>

      {/* SHOW ASSIGNED ROUTES BUTTON */}
      <button style={{ zIndex: 9999 }} onClick={handleToggleAssignedRoutes}
        className={`absolute top-28 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm shadow-md transition-all duration-200 active:scale-95 ${showAssignedRouteMenu ? "bg-gray-800 hover:bg-gray-900 text-white" : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-lg"}`}>
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
              <button key={r.sessionId || r.id || i}
                onClick={async () => {
                  setShowAssignedRouteMenu(false);
                  clearRouteVisualization(); // Remove current routes before drawing the selected one
                  try {
                    const res = await fetch(`${API_ORIGIN}/api/route-sessions/${r.sessionId}/routes`,
                      { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
                    if (!res.ok) throw new Error('Failed to fetch route');
                    const json = await res.json();
                    const vehicleRoutes = Array.isArray(json) ? json : (json.data || []);
                    // Build a synthetic snapshot so we can reuse the shared visualizeRoutes logic
                    const fakeSnapshot: RouteSessionSnapshot = {
                      sessionId: r.sessionId, userId: 0, version: 0, status: 'READY',
                      trigger: 'ASSIGNED_ROUTES', selectedBinIds: [], addedBinIds: [], removedBinIds: [],
                      route: {
                        totalVehiclesUsed: vehicleRoutes.length,
                        routes: Object.fromEntries(vehicleRoutes.map((vr: any, idx: number) => [
                          String(idx),
                          { vehicleId: idx, capacity: vr.capacity, totalBins: vr.totalBins,
                            estimatedDurationSeconds: vr.estimatedDurationSeconds,
                            binSequence: (vr.binStops ?? []).map((s: any) => ({
                              stopOrder: s.stopOrder, binId: s.binId, lat: s.lat, lng: s.lng,
                              durationFromPrevStopSeconds: s.durationFromPrevSeconds,
                            }))
                          }
                        ]))
                      },
                      message: null
                    };
                    await visualizeRoutes(fakeSnapshot);
                  } catch (e) { console.error('Failed to visualize assigned route', e); }
                }}
                className="flex items-start text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-gray-100 group">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200 transition-colors shrink-0">
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

      {/* ROUTE MENU DROPDOWN */}
      {showRouteMenu && (
        <div style={{ zIndex: 9999 }} className="absolute top-16 right-40 z-[2000] bg-white rounded-xl shadow-xl border border-gray-100 w-72 overflow-hidden flex flex-col">
          <button onClick={handleSelectBins}
            className="flex items-start text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-100 group">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200 transition-colors shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="ml-3">
              <span className="block font-semibold text-gray-800 text-sm">Select Bins</span>
              <span className="block text-xs text-gray-500 mt-0.5">Manually choose specific bins on the map</span>
            </div>
          </button>
          <button onClick={handleOptimizeZone}
            className="flex items-start text-left px-4 py-3 hover:bg-green-50 transition-colors group">
            <div className="p-2 bg-green-100 text-green-600 rounded-lg group-hover:bg-green-200 transition-colors shrink-0">
              <Route className="w-5 h-5" />
            </div>
            <div className="ml-3">
              <span className="block font-semibold text-gray-800 text-sm">Optimize by Zone</span>
              <span className="block text-xs text-gray-500 mt-0.5">Auto-generate the most efficient collection route</span>
            </div>
          </button>
        </div>
      )}

      {/* CONTEXT MENU — appears on right-click of a bin marker */}
      {contextMenu && (
        <div style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="absolute bg-white shadow-xl rounded-lg p-2 z-[2000] min-w-[180px] border border-gray-100 flex flex-col gap-1">
          <div className="text-xs font-semibold text-gray-500 px-2 py-1 uppercase tracking-wider flex justify-between items-center">
            <span>Manage Bin</span>
            <button onClick={() => setContextMenu(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="px-2 py-1">
            <label className="text-xs text-gray-700 font-medium block mb-1">Priority</label>
            <select className="w-full text-sm border border-gray-200 rounded p-1.5 bg-gray-50 focus:ring focus:ring-blue-200 outline-none"
              value={markers.get(contextMenu.binId)?.data.priority || 'medium'}
              onChange={(e) => updatePriority(contextMenu.binId, e.target.value as BinData['priority'])}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="px-2 py-1">
            <label className="text-xs text-gray-700 font-medium block mb-1">Zone (Number)</label>
            <input type="number" min="1" placeholder="e.g. 1"
              className="w-full text-sm border border-gray-200 rounded p-1.5 bg-gray-50 focus:ring focus:ring-blue-200 outline-none"
              value={markers.get(contextMenu.binId)?.data.zone || ''}
              onBlur={(e) => updateZone(contextMenu.binId, e.target.value)} // Persist on blur for a smoother UX
              onChange={(e) => updateBinLocally(contextMenu.binId, { zone: e.target.value })} // Update locally on each keystroke
              onKeyDown={(e) => { if (e.key === 'Enter') { updateZone(contextMenu.binId, e.currentTarget.value); setContextMenu(null); } }} // Also persist and close on Enter
            />
          </div>
          <hr className="my-1 border-gray-100" />
          <button onClick={() => removeBin(contextMenu.binId)}
            className="text-left px-2 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors font-medium flex items-center gap-2">
            🗑 Remove Bin
          </button>
        </div>
      )}
    </div>
  );
}