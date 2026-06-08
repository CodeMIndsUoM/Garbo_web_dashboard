'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon as turfPolygon } from "@turf/helpers";
import allBoundariesData from '../data/council_boundaries.json';
import {
  MapPin,
  Route as RouteIcon,
  Plus,
  Navigation,
  Clock,
  Info,
  Layers,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Trash2,
  X,
  Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Switch } from "./ui/switch";
import { GarboLoader } from "./GarboLoader";
import { toast } from "sonner";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081'; // Base URL for all API calls; overridable via env
const BINS_API = `${API_ORIGIN}/api/bins`; // REST endpoint for bin CRUD operations
const ROUTE_SESSION_API = `${API_ORIGIN}/api/route-sessions`; // REST endpoint for route session management
const DEFAULT_VEHICLE_CAPACITY = 25; // Fallback capacity when vehicle data is unavailable
const ROUTE_COLORS = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#db2777', '#0891b2']; // Distinct colors cycled per vehicle route

// Maps bin fill status strings to their corresponding indicator colors
const STATUS_COLOR_MAP: Record<string, string> = {
  full: '#ef4444',       // Red — bin needs immediate collection
  half: '#f59e0b',       // Amber — bin is partially filled
  empty: '#10b981',      // Green — bin has been emptied
  not_checked: '#94a3b8' // Grey — bin status is unknown
};

// Generates beautiful custom SVG bin HTML based on status, fill level, and selection state
const createBinIconHtml = (id: string, status: string = 'not_checked', fillLevel: number = 0, isSelected: 'route' | 'delete' | boolean = false) => {
  const color = STATUS_COLOR_MAP[status.toLowerCase()] || STATUS_COLOR_MAP['not_checked'];
  let fillPercent = fillLevel;
  if (fillPercent <= 1) fillPercent = fillPercent * 100;
  if (!fillPercent) {
    if (status === 'full') fillPercent = 90;
    else if (status === 'half') fillPercent = 50;
    else if (status === 'empty') fillPercent = 10;
    else fillPercent = 25;
  }

  return `
    <div class="relative flex items-center justify-center transition-transform hover:scale-110" style="width: 28px; height: 34px; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.25));">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fillGrad-${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="${100 - fillPercent}%" stop-color="#f1f5f9" stop-opacity="0.9" />
            <stop offset="${100 - fillPercent}%" stop-color="${color}" />
          </linearGradient>
        </defs>
        <!-- Background fill for the inside of the bin -->
        <rect x="8" y="9" width="8" height="10" fill="url(#fillGrad-${id})" />
        
        <!-- Custom Bin body and lid paths -->
        <path fill-rule="evenodd" clip-rule="evenodd" d="M15.5 4L14.5 3H9.5L8.5 4H5V6H19V4H15.5ZM6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM16 9H8V19H16V9Z" fill="#1e293b"/>
        <path d="M10 13H14V15H10V13Z" fill="#1e293b"/>
      </svg>
      ${isSelected ? `
      <div class="absolute -top-1.5 -right-1.5 ${isSelected === 'delete' ? 'bg-red-500' : 'bg-green-500'} text-white rounded-full border-2 border-white flex items-center justify-center shadow-lg" style="width: 17px; height: 17px; z-index: 10;">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          ${isSelected === 'delete' ? `
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          ` : `
            <polyline points="20 6 9 17 4 12"></polyline>
          `}
        </svg>
      </div>
      ` : ''}
    </div>
  `;
};

// Generates L.divIcon using the customized SVG bin content
const getStatusIcon = (id: string, status?: string, fillLevel?: number, isSelected?: 'route' | 'delete' | boolean) => {
  return L.divIcon({
    html: createBinIconHtml(id, status, fillLevel, isSelected),
    className: '',
    iconSize: [28, 34],
    iconAnchor: [14, 34],
  });
};

// Larger purple square icon representing the central depot/start point
const depotIcon = L.divIcon({
  html: `<div style="width:36px;height:36px;background-color:#9333ea;border:2px solid white;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-4 9 4v13"></path><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"></path></svg></div>`,
  className: '', iconSize: [36, 36], iconAnchor: [18, 36],
});

// Retrieves the JWT from sessionStorage and constructs Authorization headers for authenticated API calls
const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
  return (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
};

interface BinData {
  id: string;
  lat: number;
  lng: number;
  fillLevel: number;
  council?: string;
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
  status: 'PROCESSING' | 'READY' | 'ERROR' | 'SESSION_CREATED' | 'COMPLETED' | 'CANCELLED'; // Lifecycle states pushed via WebSocket
  trigger: string;
  selectedBinIds: number[];
  addedBinIds: number[];
  removedBinIds: number[];
  route: RouteResponse | null; // Null while the session is still processing
  message: string | null;     // Human-readable error or status message from the server
}

interface LoadedRouteSession {
  sessionId: string;
  vehicleCode?: string;
  driverName?: string;
  createdDate?: string;
  status?: string;
  color: string;
}

interface CouncilBoundaryDTO {
  council: string;
  depotLat: number;
  depotLng: number;
  boundaryPoints: { lat: number; lng: number }[]; // Ordered polygon vertices defining the municipal boundary
}

type BinMarkersMap = Map<string, { marker: L.Marker; data: BinData }>; // Maps bin ID → Leaflet marker + domain data
type LatLngTuple = [number, number];

export default function MapView({ council: initialCouncil }: { council?: { name?: string } | null }) {

  const mapRef = useRef<HTMLDivElement | null>(null);   // DOM node that Leaflet mounts into
  const leafletMapRef = useRef<L.Map | null>(null);            // Leaflet map instance; null before initialisation
  const addModeRef = useRef(false);                         // Ref mirror of addMode — readable inside map event closures without stale state
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);   // Parent layer group for all route sessions
  const sessionLayersRef = useRef<Map<string, L.FeatureGroup>>(new Map());
  const sessionSnapshotsRef = useRef<Map<string, RouteSessionSnapshot>>(new Map());
  const visibleSessionIdsRef = useRef<Record<string, boolean>>({});
  const stompClientRef = useRef<Client | null>(null);           // Active STOMP client for the route WebSocket subscription
  const depotMarkerRef = useRef<L.Marker | null>(null);         // Reference to the depot marker for potential repositioning
  const turfPolyRef = useRef<ReturnType<typeof turfPolygon> | null>(null); // Turf polygon used for point-in-polygon boundary checks
  const boundaryLayerRef = useRef<L.FeatureGroup | null>(null);   // Holds the boundary outline polygons
  const maskLayerRef = useRef<L.Polygon | null>(null);        // Holds the inverted dimming mask polygon
  const prevCouncilRef = useRef<string | null>(null);           // Tracks the previously selected council name for animated transitions
  const allBoundsRef = useRef<L.LatLngBounds | null>(null);   // Cached combined bounds of all councils for zoom-out transitions
  const markersRef = useRef<BinMarkersMap>(new Map());
  const toggleBinSelectionRef = useRef<(id: string) => void>(() => {});
  const toggleDeleteBinSelectionRef = useRef<(id: string) => void>(() => {});

  const [council, setCouncil] = useState(initialCouncil);
  const councilRef = useRef(council);
  useEffect(() => { councilRef.current = council; }, [council]);

  useEffect(() => {
    if (initialCouncil?.name !== council?.name) {
      setCouncil(initialCouncil);
    }
  }, [initialCouncil]);

  const [focusMode, setFocusMode] = useState(true);               // Toggle visual dimming mask on/off

  // Council boundary state
  const [boundaryData, setBoundaryData] = useState<CouncilBoundaryDTO | null>(null); // API response for the council's boundary + depot
  const [boundaryLoading, setBoundaryLoading] = useState(true); // Prevents map initialisation before boundary is resolved

  const [markers, setMarkers] = useState<BinMarkersMap>(new Map()); // All rendered bin markers indexed by bin ID
  const [addMode, setAddMode] = useState(false); // When true, map clicks trigger new-bin placement
  const [contextMenu, setContextMenu] = useState<{ binId: string } | null>(null); // Right-click context menu state for a specific bin
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number } | null>(null); // Anchor coordinates for the context menu
  const [assignedRoutes, setAssignedRoutes] = useState<any[]>([]); // Routes previously assigned to the current user
  const [loadingRoutes, setLoadingRoutes] = useState(false); // Loading indicator for the assigned routes fetch
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false); // Loading state for route generation
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false); // Controls the new-bin creation dialog
  const [newBin, setNewBin] = useState({ location: '', type: 'General Waste', zone: '', council: '' }); // Form state for the new bin dialog

  const [selectionMode, setSelectionMode] = useState(false); // When true, map markers are tappable for route bin selection
  const [selectedBins, setSelectedBins] = useState<string[]>([]); // IDs of bins chosen for the next route optimisation
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null); // WebSocket session being monitored
  const [routeStatus, setRouteStatus] = useState<string>(''); // Latest status string received from the WebSocket
  const [routeError, setRouteError] = useState<string>(''); // Error message displayed in the status banner
  const [vehicles, setVehicles] = useState<any[]>([]); // Available vehicles fetched for the route form
  const [drivers, setDrivers] = useState<any[]>([]); // Available drivers fetched for the route form
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(''); // Selected vehicle ID in the route setup panel
  const [selectedDriverId, setSelectedDriverId] = useState<string>(''); // Selected driver ID in the route setup panel
  const selectionModeRef = useRef(false); // Ref mirror of selectionMode — used inside Leaflet click closures
  const [deleteSelectionMode, setDeleteSelectionMode] = useState(false); // When true, map markers are tappable for bulk bin delete selection
  const [selectedBinsToDelete, setSelectedBinsToDelete] = useState<string[]>([]); // IDs of bins marked for bulk deletion
  const deleteSelectionModeRef = useRef(false); // Ref mirror of deleteSelectionMode — used inside Leaflet click closures

  // Overhaul custom UI states
  const [isPlannerExpanded, setIsPlannerExpanded] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [councilTransitioning, setCouncilTransitioning] = useState(false);
  const [historyTab, setHistoryTab] = useState<'all' | 'active' | 'completed'>('all');
  const [hoverPreview, setHoverPreview] = useState(false);
  const [loadedRouteSessions, setLoadedRouteSessions] = useState<LoadedRouteSession[]>([]);
  const [visibleSessionIds, setVisibleSessionIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    visibleSessionIdsRef.current = visibleSessionIds;
  }, [visibleSessionIds]);

  const canManageBin = (binId: string) => {
    const entry = markers.get(binId);
    if (!entry) return false;

    const role = typeof window !== 'undefined' ? sessionStorage.getItem('role') : null;
    if (role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'role_superadmin') {
      return true;
    }

    const activeCouncil = council?.name?.trim().toLowerCase();
    const binCouncil = entry.data.council?.trim().toLowerCase();
    return !activeCouncil || !binCouncil || activeCouncil === binCouncil;
  };

  // ── Fetch council boundary from API ────────────────────────────────────────
  useEffect(() => {
    if (!council?.name) {
      setBoundaryLoading(false); // No council context; skip fetch and proceed with defaults
      return;
    }

    // Try to load from local static file first to prevent network delay/latency
    const localBoundary = (allBoundariesData as Record<string, any>)[council.name];
    if (localBoundary) {
      setBoundaryData(localBoundary);
      setBoundaryLoading(false);
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
  useEffect(() => { deleteSelectionModeRef.current = deleteSelectionMode; }, [deleteSelectionMode]);
  useEffect(() => { markersRef.current = markers; }, [markers]);
  useEffect(() => { toggleBinSelectionRef.current = toggleBinSelection; });
  useEffect(() => { toggleDeleteBinSelectionRef.current = toggleDeleteBinSelection; });

  // Dynamically repositions context menu to stay anchored to its bin marker during map panning/zooming
  useEffect(() => {
    if (!contextMenu || !leafletMapRef.current) {
      setContextMenuPos(null);
      return;
    }

    const updateContextMenuPosition = () => {
      const entry = markersRef.current.get(contextMenu.binId);
      if (!entry || !leafletMapRef.current) return;
      const containerPoint = leafletMapRef.current.latLngToContainerPoint(entry.marker.getLatLng());
      setContextMenuPos({
        x: containerPoint.x,
        y: containerPoint.y - 12
      });
    };

    updateContextMenuPosition();

    const map = leafletMapRef.current;
    const handleMapChange = () => {
      updateContextMenuPosition();
    };

    map.on('move zoom viewreset drag', handleMapChange);
    return () => {
      map.off('move zoom viewreset drag', handleMapChange);
    };
  }, [contextMenu]);

  // Fetches vehicles and drivers whenever selection mode opens or the council changes
  useEffect(() => {
    const fetchResources = async () => {
      const token = sessionStorage.getItem('token');
      const authHeaders = (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
      const councilQuery = council?.name ? `?council=${encodeURIComponent(council.name)}` : ''; // Scope resources to the active council
      try {
        const [vehRes, drvRes] = await Promise.all([
          fetch(`${API_ORIGIN}/api/route-sessions/available-vehicles${councilQuery}`, { headers: authHeaders }),
          fetch(`${API_ORIGIN}/api/route-sessions/available-drivers${councilQuery}`, { headers: authHeaders })
        ]);
        if (vehRes.ok) { const j = await vehRes.json(); if (j.success) setVehicles(j.data); }
        if (drvRes.ok) { const j = await drvRes.json(); if (j.success) setDrivers(j.data); }
      } catch (e) { console.error('Failed to fetch routing resources', e); }
    };
    fetchResources();
  }, [selectionMode, council?.name]);

  // Reset bin selection and routing states when the council context changes
  useEffect(() => {
    if (selectedBins.length > 0) {
      clearSelectedBinIcons(selectedBins);
      setSelectedBins([]);
    }
    setSelectionMode(false);
    clearRouteVisualization();
  }, [council?.name]);

  // Toggles a bin's selection state and swaps its marker icon between status-based and the green checkmark
  const toggleBinSelection = (id: string) => {
    const entry = markers.get(id);
    if (!entry) return;

    // Guard: Prevent selecting bins that do not match the current council context
    if (council?.name && entry.data.council && entry.data.council.trim().toLowerCase() !== council.name.trim().toLowerCase()) {
      return;
    }

    setSelectedBins(prev => {
      const isSelected = prev.includes(id);
      const newSelected = isSelected ? prev.filter(b => b !== id) : [...prev, id];
      setMarkers(currentMarkers => {
        const m = new Map(currentMarkers);
        const item = m.get(id);
        if (item) {
          // Revert to fill-status icon if deselecting, otherwise apply the selection checkmark
          item.marker.setIcon(getStatusIcon(id, item.data.status, item.data.fillLevel, !isSelected ? 'route' : false));
        }
        return m;
      });
      return newSelected;
    });
  };

  // Toggles a bin's deletion selection state and swaps its marker icon between status-based and the red X
  const toggleDeleteBinSelection = (id: string) => {
    const entry = markers.get(id);
    if (!entry) return;

    // Guard: Prevent selecting bins that do not match the current council context
    if (council?.name && entry.data.council && entry.data.council.trim().toLowerCase() !== council.name.trim().toLowerCase()) {
      return;
    }

    setSelectedBinsToDelete(prev => {
      const isSelected = prev.includes(id);
      const newSelected = isSelected ? prev.filter(b => b !== id) : [...prev, id];
      setMarkers(currentMarkers => {
        const m = new Map(currentMarkers);
        const item = m.get(id);
        if (item) {
          // Revert to fill-status icon if deselecting, otherwise apply the deletion cross
          item.marker.setIcon(getStatusIcon(id, item.data.status, item.data.fillLevel, !isSelected ? 'delete' : false));
        }
        return m;
      });
      return newSelected;
    });
  };

  // Restores the fill-status icon for every previously selected bin when exiting selection mode
  const clearSelectedBinIcons = (ids: string[]) => {
    ids.forEach(id => {
      const entry = markersRef.current.get(id);
      if (entry) entry.marker.setIcon(getStatusIcon(id, entry.data.status, entry.data.fillLevel, false));
    });
  };

  const getOrCreateSessionLayer = (sessionId: string): L.FeatureGroup => {
    let layer = sessionLayersRef.current.get(sessionId);
    if (!layer) {
      layer = L.featureGroup();
      sessionLayersRef.current.set(sessionId, layer);
    }
    return layer;
  };

  const applySessionLayerVisibility = (sessionId: string, visible: boolean) => {
    const layer = sessionLayersRef.current.get(sessionId);
    if (!layer || !routeLayerRef.current) return;
    if (visible) {
      if (!routeLayerRef.current.hasLayer(layer)) {
        layer.addTo(routeLayerRef.current);
      }
    } else if (routeLayerRef.current.hasLayer(layer)) {
      routeLayerRef.current.removeLayer(layer);
    }
  };

  const fitBoundsToVisibleRoutes = () => {
    if (!routeLayerRef.current || !leafletMapRef.current) return;
    const bounds = routeLayerRef.current.getBounds();
    if (bounds.isValid()) leafletMapRef.current.fitBounds(bounds.pad(0.15));
  };

  const buildSnapshotFromRoutes = (
    sessionId: string,
    userId: number,
    vehicleRoutes: any[],
    assignmentId?: number | string,
    trigger = 'LOAD'
  ): RouteSessionSnapshot => ({
    sessionId,
    userId,
    version: 0,
    status: 'READY',
    trigger,
    selectedBinIds: [],
    addedBinIds: [],
    removedBinIds: [],
    route: {
      totalVehiclesUsed: vehicleRoutes.length,
      routes: Object.fromEntries(
        vehicleRoutes.map((vr: any, idx: number) => [
          vr.vehicleId ? String(vr.vehicleId) : `v-${assignmentId ?? sessionId}-${idx}`,
          {
            vehicleId: vr.vehicleId || idx,
            capacity: vr.capacity,
            totalBins: vr.totalBins,
            estimatedDurationSeconds: vr.estimatedDurationSeconds,
            binSequence: (vr.binStops ?? []).map((s: any) => ({
              stopOrder: s.stopOrder,
              binId: s.binId,
              lat: s.lat,
              lng: s.lng,
              durationFromPrevStopSeconds:
                s.durationFromPrevSeconds || s.durationFromPrevStopSeconds || 0,
            })),
          },
        ])
      ),
    },
    message: null,
  });

  // Removes all route polylines from the map without affecting bin markers
  const clearRouteVisualization = () => {
    sessionLayersRef.current.forEach((layer) => {
      layer.clearLayers();
      if (routeLayerRef.current?.hasLayer(layer)) {
        routeLayerRef.current.removeLayer(layer);
      }
    });
    sessionLayersRef.current.clear();
    sessionSnapshotsRef.current.clear();
    visibleSessionIdsRef.current = {};
    setLoadedRouteSessions([]);
    setVisibleSessionIds({});
    if (routeLayerRef.current) routeLayerRef.current.clearLayers();
  };

  const isPointInsideCouncil = (lat: number, lng: number) => {
    if (!turfPolyRef.current) return true;
    return booleanPointInPolygon(point([lng, lat]), turfPolyRef.current);
  };

  const clipRouteSegmentToCouncil = (start: LatLngTuple, end: LatLngTuple): LatLngTuple[] => {
    if (!turfPolyRef.current) return [start, end];

    const polygonRing = boundaryData?.boundaryPoints ?? [];
    if (polygonRing.length < 3) return [start, end];

    const points: LatLngTuple[] = [start];
    const intersections = new Set<number>([0, 1]);

    const segmentIntersection = (
      a: LatLngTuple,
      b: LatLngTuple,
      c: LatLngTuple,
      d: LatLngTuple
    ): { t: number; u: number } | null => {
      const x1 = a[1], y1 = a[0];
      const x2 = b[1], y2 = b[0];
      const x3 = c[1], y3 = c[0];
      const x4 = d[1], y4 = d[0];
      const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
      if (Math.abs(denom) < 1e-12) return null;

      const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
      const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denom;
      if (t < 0 || t > 1 || u < 0 || u > 1) return null;
      return { t, u };
    };

    const pointAt = (t: number): LatLngTuple => [
      start[0] + (end[0] - start[0]) * t,
      start[1] + (end[1] - start[1]) * t,
    ];

    const polygonPoints = polygonRing.map(p => [p.lat, p.lng] as LatLngTuple);
    for (let i = 0; i < polygonPoints.length; i++) {
      const edgeStart = polygonPoints[i];
      const edgeEnd = polygonPoints[(i + 1) % polygonPoints.length];
      const hit = segmentIntersection(start, end, edgeStart, edgeEnd);
      if (hit) intersections.add(hit.t);
    }

    const sortedT = Array.from(intersections).sort((a, b) => a - b);
    const clipped: LatLngTuple[] = [];

    for (let i = 0; i < sortedT.length - 1; i++) {
      const t0 = sortedT[i];
      const t1 = sortedT[i + 1];
      if (t1 - t0 < 1e-6) continue;
      const mid = pointAt((t0 + t1) / 2);
      if (!isPointInsideCouncil(mid[0], mid[1])) continue;

      const segStart = pointAt(t0);
      const segEnd = pointAt(t1);
      if (clipped.length === 0) {
        clipped.push(segStart, segEnd);
      } else {
        const last = clipped[clipped.length - 1];
        if (last[0] !== segStart[0] || last[1] !== segStart[1]) clipped.push(segStart);
        clipped.push(segEnd);
      }
    }

    return clipped;
  };

  const clipPolylineToCouncil = (latLngs: LatLngTuple[]) => {
    if (latLngs.length < 2) return [] as LatLngTuple[][];

    const segments: LatLngTuple[][] = [];
    let currentSegment: LatLngTuple[] = [];

    for (let i = 0; i < latLngs.length - 1; i++) {
      const clipped = clipRouteSegmentToCouncil(latLngs[i], latLngs[i + 1]);
      if (clipped.length < 2) {
        if (currentSegment.length >= 2) {
          segments.push(currentSegment);
        }
        currentSegment = [];
        continue;
      }

      if (currentSegment.length === 0) {
        currentSegment = [...clipped];
        continue;
      }

      const last = currentSegment[currentSegment.length - 1];
      const first = clipped[0];
      if (last[0] !== first[0] || last[1] !== first[1]) {
        segments.push(currentSegment);
        currentSegment = [...clipped];
      } else {
        currentSegment.push(...clipped.slice(1));
      }
    }

    if (currentSegment.length >= 2) {
      segments.push(currentSegment);
    }

    return segments;
  };

  // Extracts the current user's ID from the persisted admin object in sessionStorage
  const getCurrentUserId = () => {
    if (typeof window === 'undefined') return 1; // SSR safety — default to a placeholder ID
    const raw = sessionStorage.getItem('admin');
    if (!raw) return 1;
    try {
      const admin = JSON.parse(raw);
      const idCandidate = Number(admin?.id ?? admin?.userId);
      return Number.isFinite(idCandidate) && idCandidate > 0 ? idCandidate : 1; // Guard against NaN or negative IDs
    } catch { return 1; }
  };

  // Builds a road-snapped polyline for one vehicle's stops using OSRM, falling back to straight lines on failure
  const buildRoadPolyline = async (
    stops: RouteBinStop[],
    strokeColor: string,
    vehicleId: string,
    targetLayer: L.FeatureGroup,
    isCompleted: boolean = false
  ) => {
    if (!leafletMapRef.current || stops.length === 0) return;

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

    // Visual configurations based on completed vs active routes
    const routeColor = isCompleted ? '#475569' : strokeColor;
    const className = isCompleted ? '' : 'animate-route-flow';
    const dashArray = isCompleted ? undefined : '10, 10';

    try {
      const osrmRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${osrmCoordString}?overview=full&geometries=geojson`
      );
      if (!osrmRes.ok) throw new Error(`OSRM failed for vehicle ${vehicleId}`);
      const osrmJson = await osrmRes.json();
      const coords = osrmJson?.routes?.[0]?.geometry?.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length === 0) throw new Error('No geometry from OSRM');
      const latLngs: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]); // Convert GeoJSON [lng,lat] → Leaflet [lat,lng]

      const clippedSegments = clipPolylineToCouncil(latLngs);
      if (clippedSegments.length === 0) return;

      clippedSegments.forEach((segment, index) => {
        L.polyline(segment, {
          color: routeColor,
          weight: 5,
          opacity: 0.85,
          className,
          dashArray
        })
          .bindTooltip(`Vehicle ${vehicleId}${index > 0 ? ' (continued)' : ''}`)
          .addTo(targetLayer);
      });
    } catch {
      // Fallback: draw a straight-line polyline
      const clippedSegments = clipPolylineToCouncil(pathCoordinates);
      if (clippedSegments.length === 0) return;

      clippedSegments.forEach((segment, index) => {
        L.polyline(segment, {
          color: routeColor,
          weight: 4,
          opacity: 0.75,
          dashArray: isCompleted ? undefined : '10, 10',
          className
        })
          .bindTooltip(`Vehicle ${vehicleId} (fallback${index > 0 ? ' continued' : ''})`)
          .addTo(targetLayer);
      });
    }
  };

  const visualizeRoutesInternal = async (
    snapshot: RouteSessionSnapshot,
    options: {
      sessionColor?: string;
      storeSnapshot?: boolean;
      fitMap?: boolean;
      forceVisible?: boolean;
    } = {}
  ) => {
    if (!leafletMapRef.current || !snapshot.route?.routes) return;
    const sessionId = snapshot.sessionId;
    if (options.storeSnapshot !== false) {
      sessionSnapshotsRef.current.set(sessionId, snapshot);
    }

    const sessionLayer = getOrCreateSessionLayer(sessionId);
    sessionLayer.clearLayers();

    const isCompleted = snapshot.status === 'COMPLETED';
    const sessionColor = options.sessionColor || ROUTE_COLORS[0];
    const routeEntries = Object.entries(snapshot.route.routes);

    await Promise.all(
      routeEntries.map(async ([vehicleKey, vehicleRoute], index) => {
        const vehicleColor =
          routeEntries.length === 1
            ? sessionColor
            : ROUTE_COLORS[index % ROUTE_COLORS.length];
        await buildRoadPolyline(
          vehicleRoute.binSequence || [],
          vehicleColor,
          vehicleKey,
          sessionLayer,
          isCompleted
        );
      })
    );

    const visible =
      options.forceVisible ?? visibleSessionIdsRef.current[sessionId] ?? false;
    applySessionLayerVisibility(sessionId, visible);
    if (options.fitMap && visible) fitBoundsToVisibleRoutes();
  };

  // Live route from WebSocket — show only the new session by default
  const visualizeRoutes = async (snapshot: RouteSessionSnapshot) => {
    const color = ROUTE_COLORS[0];
    const entry: LoadedRouteSession = {
      sessionId: snapshot.sessionId,
      color,
      status: snapshot.status,
    };
    setLoadedRouteSessions((prev) => [
      entry,
      ...prev.filter((s) => s.sessionId !== snapshot.sessionId),
    ]);
    const visibility = { [snapshot.sessionId]: true };
    setVisibleSessionIds(visibility);
    visibleSessionIdsRef.current = visibility;
    sessionLayersRef.current.forEach((_, sid) => {
      if (sid !== snapshot.sessionId) applySessionLayerVisibility(sid, false);
    });
    await visualizeRoutesInternal(snapshot, {
      sessionColor: color,
      fitMap: true,
      forceVisible: true,
    });
  };

  const toggleSessionVisibility = async (sessionId: string, visible: boolean) => {
    setVisibleSessionIds((prev) => {
      const next = { ...prev, [sessionId]: visible };
      visibleSessionIdsRef.current = next;
      return next;
    });

    if (!visible) {
      applySessionLayerVisibility(sessionId, false);
      return;
    }

    let snap = sessionSnapshotsRef.current.get(sessionId);
    if (!snap) {
      await fetchAndCacheSessionSnapshot(sessionId);
      snap = sessionSnapshotsRef.current.get(sessionId);
    }
    if (!snap) return;

    const meta = loadedRouteSessions.find((s) => s.sessionId === sessionId);
    await visualizeRoutesInternal(snap, {
      sessionColor: meta?.color,
      fitMap: true,
      forceVisible: true,
    });
  };

  const showAllRoutes = async () => {
    const next: Record<string, boolean> = {};
    for (const s of loadedRouteSessions) next[s.sessionId] = true;
    setVisibleSessionIds(next);
    visibleSessionIdsRef.current = next;

    for (const s of loadedRouteSessions) {
      let snap = sessionSnapshotsRef.current.get(s.sessionId);
      if (!snap) {
        await fetchAndCacheSessionSnapshot(s.sessionId);
        snap = sessionSnapshotsRef.current.get(s.sessionId);
      }
      if (snap) {
        await visualizeRoutesInternal(snap, {
          sessionColor: s.color,
          storeSnapshot: false,
          forceVisible: true,
        });
      }
    }
    fitBoundsToVisibleRoutes();
  };

  const hideAllRoutes = () => {
    const next: Record<string, boolean> = {};
    for (const s of loadedRouteSessions) next[s.sessionId] = false;
    setVisibleSessionIds(next);
    visibleSessionIdsRef.current = next;
    sessionLayersRef.current.forEach((_, sid) => applySessionLayerVisibility(sid, false));
  };

  const restoreRouteVisibility = async () => {
    for (const s of loadedRouteSessions) {
      const visible = visibleSessionIdsRef.current[s.sessionId] ?? false;
      if (visible) {
        const snap = sessionSnapshotsRef.current.get(s.sessionId);
        if (snap) {
          await visualizeRoutesInternal(snap, {
            sessionColor: s.color,
            storeSnapshot: false,
            forceVisible: true,
            fitMap: false,
          });
        }
      } else {
        applySessionLayerVisibility(s.sessionId, false);
      }
    }
    fitBoundsToVisibleRoutes();
  };

  const previewRouteSession = async (sessionId: string) => {
    let snap = sessionSnapshotsRef.current.get(sessionId);
    if (!snap) {
      await fetchAndCacheSessionSnapshot(sessionId);
      snap = sessionSnapshotsRef.current.get(sessionId);
    }
    if (!snap) return;
    sessionLayersRef.current.forEach((_, sid) => applySessionLayerVisibility(sid, false));
    const meta = loadedRouteSessions.find((s) => s.sessionId === sessionId);
    await visualizeRoutesInternal(snap, {
      sessionColor: meta?.color || ROUTE_COLORS[0],
      forceVisible: true,
      fitMap: true,
    });
  };

  // Lazy-load assigned routes from the API
  const loadRouteHistory = async () => {
    setLoadingRoutes(true);
    try {
      const userId = getCurrentUserId();
      const res = await fetch(`${API_ORIGIN}/api/route-sessions/user/${userId}/active`,
        { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } });
      if (res.ok) {
        const json = await res.json();
        const routes = Array.isArray(json) ? json : json.data || [];
        setAssignedRoutes(routes);
        syncLoadedSessionsFromRoutes(routes);
      }
    } catch (e) {
      console.error('Failed to fetch assigned routes', e);
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear your route history? This will permanently delete all history sessions, reset the associated vehicles back to available, and mark bins as unassigned.")) return;
    try {
      const userId = getCurrentUserId();
      const res = await fetch(`${API_ORIGIN}/api/route-sessions/user/${userId}/clear`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.ok) {
        setAssignedRoutes([]);
        clearRouteVisualization();
        toast.success("Route history cleared successfully");
      } else {
        const json = await res.json();
        toast.error(json.error || "Failed to clear route history");
      }
    } catch (e) {
      console.error('Failed to clear route history', e);
      toast.error("An error occurred while clearing route history");
    }
  };

  const fetchAndCacheSessionSnapshot = async (sessionId: string) => {
    const res = await fetch(`${API_ORIGIN}/api/route-sessions/${sessionId}/routes`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Failed to fetch routes');
    const json = await res.json();
    const vehicleRoutes = Array.isArray(json) ? json : json.data || [];
    const snapshot = buildSnapshotFromRoutes(
      sessionId,
      getCurrentUserId(),
      vehicleRoutes,
      sessionId,
      'HISTORY_VIEW'
    );
    sessionSnapshotsRef.current.set(sessionId, snapshot);
    return snapshot;
  };

  // Visualizes a specific history/assigned session (persistent — updates visibility toggles)
  const visualizeSession = async (sessionId: string, persistent = true) => {
    try {
      await fetchAndCacheSessionSnapshot(sessionId);
      if (persistent) {
        setVisibleSessionIds((prev) => {
          const next = { ...prev, [sessionId]: true };
          visibleSessionIdsRef.current = next;
          return next;
        });
      }
      const snap = sessionSnapshotsRef.current.get(sessionId)!;
      const meta = loadedRouteSessions.find((s) => s.sessionId === sessionId);
      await visualizeRoutesInternal(snap, {
        sessionColor: meta?.color || ROUTE_COLORS[0],
        fitMap: true,
        forceVisible: true,
      });
    } catch (e) {
      console.error('Failed to visualize session', sessionId, e);
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
      debug: () => { }       // Suppress verbose STOMP debug output in production
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

  const getSessionColor = (sessionId: string, fallbackIndex: number) => {
    const loaded = loadedRouteSessions.find((s) => s.sessionId === sessionId);
    return loaded?.color ?? ROUTE_COLORS[fallbackIndex % ROUTE_COLORS.length];
  };

  const syncLoadedSessionsFromRoutes = (routes: any[]) => {
    const active = routes
      .filter((r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED')
      .sort((a: any, b: any) => {
        const da = a.createdDate ? new Date(a.createdDate).getTime() : 0;
        const db = b.createdDate ? new Date(b.createdDate).getTime() : 0;
        return db - da;
      });

    const sessions: LoadedRouteSession[] = active.map((r: any, i: number) => {
      const existing = loadedRouteSessions.find((s) => s.sessionId === r.sessionId);
      return {
        sessionId: r.sessionId,
        vehicleCode: r.vehicleCode,
        driverName: r.driverName,
        createdDate: r.createdDate,
        status: r.status,
        color: existing?.color ?? ROUTE_COLORS[i % ROUTE_COLORS.length],
      };
    });
    setLoadedRouteSessions(sessions);
  };

  // Filter assigned routes by tab
  const filteredRoutes = useMemo(() => {
    if (historyTab === 'all') return assignedRoutes;
    return assignedRoutes.filter(r => {
      const isActive = r.status !== 'COMPLETED' && r.status !== 'CANCELLED';
      if (historyTab === 'active') return isActive;
      if (historyTab === 'completed') return !isActive;
      return true;
    });
  }, [assignedRoutes, historyTab]);

  // ── MAP INIT — wait for boundary data ─────────────────────────────────────
  useEffect(() => {
    if (boundaryLoading) return; // Defer until boundary API response is resolved
    if (mapRef.current && leafletMapRef.current) return; // Prevent double-initialisation (React StrictMode)
    if (!mapRef.current) return;

    // Enable completely free map interaction and zoom, setting an initial default center (Colombo) to prevent layer rendering crashes
    const map = L.map(mapRef.current, {
      zoomControl: false           // Zoom controls added manually at bottom-right
    }).setView([6.9271, 79.8612], 11);

    leafletMapRef.current = map;

    // Trigger map invalidation shortly after container attachment to prevent initial gray tile loads
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
      noWrap: true,
      keepBuffer: 12,       // Keeps a larger perimeter of loaded tiles in cache to prevent gray gaps when moving/panning
      updateWhenIdle: false, // Update tiles continuously during zoom/pan animations for seamless rendering
      updateWhenZooming: true
    }).addTo(map);

    // Add zoom controls to the top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initialize boundary and route layers
    boundaryLayerRef.current = L.featureGroup().addTo(map);
    routeLayerRef.current = L.featureGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      setContextMenu(null); // Dismiss any open context menu on map click
      if (!addModeRef.current) return; // Ignore clicks when not in add mode

      try {
        const pt = point([e.latlng.lng, e.latlng.lat]); // Turf point uses [lng, lat]
        let detectedCouncil: string | null = null;
        const activeCouncil = councilRef.current;

        if (activeCouncil?.name) {
          let isInside = false;
          if (turfPolyRef.current) {
            isInside = booleanPointInPolygon(pt, turfPolyRef.current);
          } else {
            // Fallback: build boundary dynamically
            const localBoundary = (allBoundariesData as Record<string, any>)[activeCouncil.name];
            if (localBoundary?.boundaryPoints?.length >= 3) {
              const coords = localBoundary.boundaryPoints.map((p: any) => [p.lng, p.lat]);
              coords.push(coords[0]);
              const poly = turfPolygon([coords]);
              isInside = booleanPointInPolygon(pt, poly);
            }
          }

          if (!isInside) {
            toast.error(`Unable to add bin outside the selected council boundary: ${activeCouncil.name}`);
            return;
          }
          detectedCouncil = activeCouncil.name;
        } else {
          // Iterate through all 5 councils in allBoundariesData (Super Admin view with no active council context)
          for (const [cName, cData] of Object.entries(allBoundariesData)) {
            if (!cData || !cData.boundaryPoints || cData.boundaryPoints.length < 3) continue;
            const coords = cData.boundaryPoints.map((p: any) => [p.lng, p.lat]);
            coords.push(coords[0]);
            const poly = turfPolygon([coords]);
            if (booleanPointInPolygon(pt, poly)) {
              detectedCouncil = cName;
              break;
            }
          }
          if (!detectedCouncil) {
            toast.error("Outside municipal area! Please click inside one of the council boundaries.");
            return;
          }
        }

        // Pre-populate the form with the clicked coordinates and open the creation dialog
        setNewBin(prev => ({ 
          ...prev, 
          location: `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`,
          council: detectedCouncil || ''
        }));
        setIsCreateModalOpen(true);
        setAddMode(false); // Exit add mode after capturing a location
      } catch (err) {
        console.error("Error handling map click for bin placement:", err);
        toast.error("An error occurred while placing the bin. Please try again.");
        setAddMode(false);
      }
    });

    map.on('movestart', () => setContextMenu(null));
    map.on('zoomstart', () => setContextMenu(null));

    loadBins();          // Fetch and render existing bins from the API
    loadActiveSession(); // Restore any previously active route session for this user

    return () => {
      disconnectRouteSocket(); // Clean up WebSocket on component unmount
      if (routeLayerRef.current) routeLayerRef.current.clearLayers();
      if (boundaryLayerRef.current) boundaryLayerRef.current.clearLayers();
    };
  }, [boundaryLoading]);

  // ── Helper: compute combined bounds of all councils (cached) ──
  const getAllCouncilBounds = (): L.LatLngBounds | null => {
    if (allBoundsRef.current) return allBoundsRef.current;
    const boundsList: L.LatLngBounds[] = [];
    Object.entries(allBoundariesData).forEach(([, cData]: [string, any]) => {
      const coords: [number, number][] = cData.boundaryPoints.map((p: any) => [p.lat, p.lng]);
      if (coords.length > 0) boundsList.push(L.latLngBounds(coords));
    });
    if (boundsList.length === 0) return null;
    let combined = boundsList[0];
    for (let i = 1; i < boundsList.length; i++) combined.extend(boundsList[i]);
    allBoundsRef.current = combined;
    return combined;
  };

  // ── Helper: draw layers and mask for a specific council, then fly to it ──
  const renderSingleCouncil = (map: L.Map, skipZoom = false) => {
    if (!boundaryData?.boundaryPoints?.length) return;

    const municipalCoords: [number, number][] = boundaryData.boundaryPoints.map(p => [p.lat, p.lng]);
    const depotLat = boundaryData.depotLat ?? 6.775080;
    const depotLng = boundaryData.depotLng ?? 79.882289;

    // Update Turf polygon reference
    const coords = municipalCoords.map(([lat, lng]) => [lng, lat]);
    coords.push(coords[0]);
    turfPolyRef.current = turfPolygon([coords]);

    // Draw boundary outline
    const poly = L.polygon(municipalCoords, {
      color: "#16a34a", weight: 2.5, fillOpacity: 0, interactive: false
    }).addTo(boundaryLayerRef.current!);

    // Smooth fly into the council bounds
    if (!skipZoom) {
      const bounds = poly.getBounds();
      if (bounds.isValid()) {
        map.flyToBounds(bounds.pad(0.05), { duration: 1.5, easeLinearity: 0.2 });
      }
    }

    // Dimming mask
    if (focusMode) {
      // Use a regional outer box around Sri Lanka instead of worldwide coordinates to prevent Leaflet/SVG clipping glitches on zoom/pan
      const sriLankaRegionOuterRing: [number, number][] = [[12.0, 77.0], [12.0, 83.0], [5.0, 83.0], [5.0, 77.0]];
      maskLayerRef.current = L.polygon([sriLankaRegionOuterRing, municipalCoords], {
        stroke: false, fillColor: "#0f172a", fillOpacity: 0.45, interactive: false
      }).addTo(map);
    }

    // Depot marker
    if (depotMarkerRef.current) {
      depotMarkerRef.current.setLatLng([depotLat, depotLng]).addTo(map);
    } else {
      depotMarkerRef.current = L.marker([depotLat, depotLng], { icon: depotIcon })
        .bindTooltip("<div class='font-bold text-sm'>Central Depot</div>")
        .addTo(map);
    }
  };

  // ── Helper: draw all council boundaries and fly to combined bounds ──
  const renderAllCouncils = (map: L.Map, skipZoom = false) => {
    turfPolyRef.current = null;
    if (depotMarkerRef.current) { depotMarkerRef.current.remove(); depotMarkerRef.current = null; }

    Object.entries(allBoundariesData).forEach(([cName, cData]: [string, any]) => {
      const coords: [number, number][] = cData.boundaryPoints.map((p: any) => [p.lat, p.lng]);
      if (coords.length > 0) {
        const poly = L.polygon(coords, {
          color: "#16a34a", weight: 2, fillOpacity: 0.02, fillColor: "#16a34a", interactive: false
        }).addTo(boundaryLayerRef.current!);
        poly.bindTooltip(`<div class="font-semibold text-xs text-green-700">${cName}</div>`, {
          permanent: true, direction: 'center',
          className: 'bg-white/80 border border-green-500/30 rounded px-1.5 py-0.5 shadow-sm font-semibold'
        });
        L.marker([cData.depotLat, cData.depotLng], { icon: depotIcon })
          .bindTooltip(`<div class='font-bold text-sm'>Depot: ${cName}</div>`)
          .addTo(boundaryLayerRef.current!);
      }
    });

    if (!skipZoom) {
      const allBounds = getAllCouncilBounds();
      if (allBounds?.isValid()) {
        map.flyToBounds(allBounds.pad(0.1), { duration: 1.0, easeLinearity: 0.25 });
      }
    }
  };

  // ── UPDATE MAP BOUNDARIES, MASKS, AND DEPOTS ON COUNCIL OR FOCUS MODE CHANGE ──
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Initialize or clear layers
    if (!boundaryLayerRef.current) {
      boundaryLayerRef.current = L.featureGroup().addTo(map);
    } else {
      boundaryLayerRef.current.clearLayers();
    }
    if (maskLayerRef.current) { maskLayerRef.current.remove(); maskLayerRef.current = null; }

    const currentCouncilName = council?.name || null;
    const prevCouncilName = prevCouncilRef.current;
    const isCouncilSwitch = prevCouncilName !== null && currentCouncilName !== null && prevCouncilName !== currentCouncilName;
    const isZoomingOut = prevCouncilName !== null && currentCouncilName === null;
    const isZoomingIn = prevCouncilName === null && currentCouncilName !== null;

    // Update the ref for next render
    prevCouncilRef.current = currentCouncilName;

    if (council?.name) {
      // Avoid rendering stale boundary data
      if (!boundaryData || boundaryData.council.trim().toLowerCase() !== council.name.trim().toLowerCase()) {
        return;
      }

      if (isCouncilSwitch) {
        // ── Loader-first council transition ──
        // Show the loading overlay immediately to cover the map
        setCouncilTransitioning(true);

        // Use requestAnimationFrame to ensure the loader renders before we mutate the map
        requestAnimationFrame(() => {
          // Clear previous layers behind the loader
          if (boundaryLayerRef.current) boundaryLayerRef.current.clearLayers();
          if (maskLayerRef.current) { maskLayerRef.current.remove(); maskLayerRef.current = null; }

          // Render the new council boundary and position the map instantly (no animation)
          renderSingleCouncil(map, true); // skipZoom = true, we'll position manually
          const polyBounds = boundaryLayerRef.current?.getBounds();
          if (polyBounds?.isValid()) {
            map.fitBounds(polyBounds.pad(0.05), { animate: false });
          }
          map.invalidateSize(); // Invalidate size before revealing to ensure correct tile layouts

          // Keep the loader visible for a minimum time so it feels intentional, then reveal
          setTimeout(() => {
            setCouncilTransitioning(false);
            // Invalidate layout again shortly after state changes and transitions complete
            setTimeout(() => map.invalidateSize(), 50);
          }, 900);
        });
      } else {
        // First load or focus-mode toggle — render directly
        renderSingleCouncil(map, !isZoomingIn);
        if (isZoomingIn) {
          // Already handled by renderSingleCouncil flyToBounds
        } else {
          // Focus mode toggle — just re-fit without animation
          const polyBounds = boundaryLayerRef.current?.getBounds();
          if (polyBounds?.isValid()) map.fitBounds(polyBounds);
        }
      }
    } else {
      // "All Councils" view
      renderAllCouncils(map, !isZoomingOut);
    }
  }, [council?.name, boundaryData, focusMode]);

  // ── UPDATE MARKER VISIBILITY ON COUNCIL FILTER CHANGE ──
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || markers.size === 0) return;

    markers.forEach(({ marker, data }) => {
      const isMatching = !council?.name || (data.council && data.council.trim().toLowerCase() === council.name.trim().toLowerCase());
      if (isMatching) {
        if (!map.hasLayer(marker)) {
          marker.addTo(map);
        }
      } else {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      }
    });
  }, [council, markers]);

  // ── LOAD BINS ────────────────────────────────────────────────────────────
  const loadBins = async () => {
    const role = typeof window !== 'undefined' ? sessionStorage.getItem('role') : null;
    const userIsSuperAdmin = role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'role_superadmin';
    
    let url = BINS_API;
    if (!userIsSuperAdmin && council?.name) {
      url = `${BINS_API}?council=${encodeURIComponent(council.name)}`;
    }

    const res = await fetch(url);
    if (!res.ok) { console.error(`Failed to load bins: ${res.status}`); return; }
    const payload = await res.json();
    let bins: any[] = [];
    if (Array.isArray(payload)) bins = payload;
    else if (payload?.data && Array.isArray(payload.data)) bins = payload.data;
    else if (payload?.value && Array.isArray(payload.value)) bins = payload.value;

    bins.forEach((bin: any) => {
      const lat = Number(bin.lat ?? bin.latitude);
      const lng = Number(bin.lng ?? bin.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      // Scoping logic: regular admins should only see bins for their own council
      if (!userIsSuperAdmin && council?.name) {
        if (!bin.council || bin.council.trim().toLowerCase() !== council.name.trim().toLowerCase()) {
          return;
        }
      }

      addMarker({
        id: String(bin.id), binCode: bin.binCode,
        lat, lng, fillLevel: bin.fillLevel,
        council: bin.council,
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
    const isSelected = selectedBins.includes(data.id) ? 'route' : (selectedBinsToDelete.includes(data.id) ? 'delete' : false);
    const marker = L.marker([data.lat, data.lng], { icon: getStatusIcon(data.id, data.status, data.fillLevel, isSelected) })
      .addTo(leafletMapRef.current);
    marker.bindTooltip(renderTooltip(data));
    marker.on('click', () => {
      if (selectionModeRef.current) {
        toggleBinSelectionRef.current(data.id);
      } else if (deleteSelectionModeRef.current) {
        toggleDeleteBinSelectionRef.current(data.id);
      }
    });
    marker.on('contextmenu', (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault(); // Prevent standard browser menu
      setContextMenu({ binId: data.id });
    });
    setMarkers(prev => { const m = new Map(prev); m.set(data.id, { marker, data }); return m; });
  };

  // Handles form submission for the new-bin creation dialog
  const handleCreateBinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(BINS_API, {
        method: "POST", headers,
        body: JSON.stringify({ location: newBin.location, type: newBin.type, zone: newBin.zone, fillLevel: 0, priority: 'medium', status: 'empty', council: newBin.council })
      });
      if (!res.ok) {
        let errMessage = 'Failed to create bin';
        try { const errData = await res.json(); errMessage = errData.message || errMessage; } catch (e) { }
        throw new Error(errMessage);
      }
      const responseData = await res.json();
      const saved = responseData.data || responseData;
      addMarker({
        id: String(saved.id), binCode: saved.binCode,
        lat: saved.lat || saved.latitude, lng: saved.lng || saved.longitude,
        fillLevel: saved.fillLevel || 0,
        priority: saved.priority || 'medium',
        zone: saved.zone || newBin.zone,
        status: saved.status || 'not_checked',
        council: saved.council
      });
      setIsCreateModalOpen(false);
      setNewBin({ location: '', type: 'General Waste', zone: '', council: '' });
      toast.success("Bin created successfully");
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "Error creating bin");
    }
  };

  // Sends a DELETE request for the given bin and removes its marker from the map
  const removeBin = async (id: string) => {
    if (!canManageBin(id)) {
      toast.error('You can only manage bins from your assigned council.');
      setContextMenu(null);
      return;
    }

    try {
      const res = await fetch(`${BINS_API}/${id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok) {
        let message = `Failed to delete bin ${id}`;
        try {
          const responseText = await res.text();
          if (responseText) {
            try {
              const parsed = JSON.parse(responseText);
              message = parsed?.message || parsed?.error || parsed?.data?.message || message;
            } catch {
              message = responseText;
            }
          }
        } catch { }
        throw new Error(message);
      }

      const entry = markers.get(id);
      if (entry && leafletMapRef.current) leafletMapRef.current.removeLayer(entry.marker);
      setMarkers(prev => { const m = new Map(prev); m.delete(id); return m; });
      setContextMenu(null);
      toast.success("Bin deleted successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to delete bin ${id}`;
      toast.error(message);
    }
  };

  // Sends a DELETE request to delete multiple selected bins and removes their markers
  const handleBulkDelete = async () => {
    if (selectedBinsToDelete.length === 0) return;

    // Check if user is authorized to manage all selected bins
    for (const id of selectedBinsToDelete) {
      if (!canManageBin(id)) {
        toast.error('You can only manage bins from your assigned council.');
        return;
      }
    }

    const confirmed = window.confirm(`Are you sure you want to delete the ${selectedBinsToDelete.length} selected bins?`);
    if (!confirmed) return;

    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('token') : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const binIds = selectedBinsToDelete.map(id => Number(id)).filter(id => Number.isFinite(id));
      const res = await fetch(`${BINS_API}/batch`, {
        method: "DELETE",
        headers,
        body: JSON.stringify(binIds)
      });

      if (!res.ok) {
        let errMessage = 'Failed to delete selected bins';
        try {
          const errData = await res.json();
          errMessage = errData.message || errMessage;
        } catch { }
        throw new Error(errMessage);
      }

      // Remove markers from Leaflet map
      selectedBinsToDelete.forEach(id => {
        const entry = markers.get(id);
        if (entry && leafletMapRef.current) {
          leafletMapRef.current.removeLayer(entry.marker);
        }
      });

      // Update markers state
      setMarkers(prev => {
        const m = new Map(prev);
        selectedBinsToDelete.forEach(id => m.delete(id));
        return m;
      });

      clearSelectedBinIcons(selectedBinsToDelete);
      setSelectedBinsToDelete([]);
      setDeleteSelectionMode(false);
      toast.success(`${binIds.length} bins deleted successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error during bulk deletion';
      toast.error(message);
    }
  };

  // Applies partial updates to a bin's data and refreshes its icon/tooltip
  const updateBinLocally = (id: string, updates: Partial<BinData>) => {
    const entry = markers.get(id);
    if (!entry) return;
    const newData = { ...entry.data, ...updates };
    entry.data = newData;
    entry.marker.bindTooltip(renderTooltip(newData));
    const isSelected = selectedBins.includes(id) ? 'route' : (selectedBinsToDelete.includes(id) ? 'delete' : false);
    entry.marker.setIcon(getStatusIcon(id, newData.status, newData.fillLevel, isSelected));
    setMarkers(new Map(markers));
  };

  // Update bin priority in DB
  const updatePriority = async (id: string, priority: BinData['priority']) => {
    try {
      if (!canManageBin(id)) {
        toast.error('You can only manage bins from your assigned council.');
        return;
      }
      const res = await fetch(`${BINS_API}/${id}/priority?priority=${encodeURIComponent(priority)}`,
        { method: "PUT", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Priority update failed: ${res.status}`);
      updateBinLocally(id, { priority });
    } catch (e) { console.error("Failed to update priority", e); }
  };

  // Update bin zone in DB
  const updateZone = async (id: string, zone: string) => {
    try {
      if (!canManageBin(id)) {
        toast.error('You can only manage bins from your assigned council.');
        return;
      }
      const res = await fetch(`${BINS_API}/${id}/zone?zone=${encodeURIComponent(zone)}`,
        { method: "PUT", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Zone update failed: ${res.status}`);
      updateBinLocally(id, { zone });
    } catch (e) { console.error("Failed to update zone", e); }
  };

  // Restores active route sessions — only the latest is visible by default (W4)
  const loadActiveSession = async () => {
    try {
      const userId = getCurrentUserId();
      const res = await fetch(`${API_ORIGIN}/api/route-sessions/user/${userId}/active`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      });
      if (!res.ok) return;

      const json = await res.json();
      const assignments = (Array.isArray(json) ? json : json.data || [])
        .filter((x: any) => x.status !== 'COMPLETED' && x.status !== 'CANCELLED')
        .sort((a: any, b: any) => {
          const da = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const db = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          return db - da;
        });

      if (assignments.length === 0) return;

      setRouteStatus('READY');
      clearRouteVisualization();

      const sessions: LoadedRouteSession[] = [];
      const visibility: Record<string, boolean> = {};

      for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        try {
          const routeRes = await fetch(
            `${API_ORIGIN}/api/route-sessions/${assignment.sessionId}/routes`,
            { headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
          );
          if (!routeRes.ok) continue;

          const vRoutes = await routeRes.json();
          const vehicleRoutes = Array.isArray(vRoutes) ? vRoutes : vRoutes.data || [];
          const snapshot = buildSnapshotFromRoutes(
            assignment.sessionId,
            userId,
            vehicleRoutes,
            assignment.id,
            'INITIAL_LOAD'
          );
          sessionSnapshotsRef.current.set(assignment.sessionId, snapshot);

          const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
          sessions.push({
            sessionId: assignment.sessionId,
            vehicleCode: assignment.vehicleCode,
            driverName: assignment.driverName,
            createdDate: assignment.createdDate,
            status: assignment.status,
            color,
          });
          visibility[assignment.sessionId] = i === 0;
        } catch (err) {
          console.error('Error loading assignment', assignment, err);
        }
      }

      setLoadedRouteSessions(sessions);
      setVisibleSessionIds(visibility);
      visibleSessionIdsRef.current = visibility;

      for (const s of sessions) {
        if (visibility[s.sessionId]) {
          const snap = sessionSnapshotsRef.current.get(s.sessionId);
          if (snap) {
            await visualizeRoutesInternal(snap, {
              sessionColor: s.color,
              storeSnapshot: false,
              forceVisible: true,
              fitMap: false,
            });
          }
        }
      }
      fitBoundsToVisibleRoutes();

      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].sessionId);
        connectRouteSocket(sessions[0].sessionId);
      }
    } catch (e) {
      console.error('Failed to load active session on mount', e);
    }
  };

  if (boundaryLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <GarboLoader variant="inline" message="Loading map..." size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-50">
      {/* Global CSS Style tag for Leaflet Polyline Dashed Flow Animation */}
      <style>{`
        @keyframes leaflet-dash {
          to {
            stroke-dashoffset: -30;
          }
        }
        .animate-route-flow {
          stroke-dasharray: 10, 12;
          animation: leaflet-dash 1.8s linear infinite;
        }
      `}</style>

      {/* Map DOM Element */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Council transition loading overlay */}
      {councilTransitioning && (
        <GarboLoader variant="overlay" message="Switching council..." size="md" />
      )}

      {/* HORIZONTAL TOOLBAR — responsive, compact, consistent */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] flex items-center bg-white/70 backdrop-blur-xl border border-white/30 rounded-2xl shadow-xl px-2 py-1.5 gap-1 transition-all w-max max-w-[calc(100vw-2rem)]">
        {/* Council badge — filter controlled globally via top bar (F1) */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50/80 text-emerald-700 border border-emerald-200/40 rounded-xl text-[11px] font-semibold shrink-0">
          <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="truncate max-w-[160px]">
            {council?.name || 'All Councils'}
          </span>
        </div>

        <div className="w-px h-5 bg-gray-300/40 shrink-0" />

        {/* Add Bin */}
        <button
          title={addMode ? 'Click map to place bin' : 'Add Bin'}
          onClick={() => {
            const nextAdd = !addMode;
            setAddMode(nextAdd);
            if (nextAdd) {
              setSelectionMode(false);
              clearSelectedBinIcons(selectedBins);
              setSelectedBins([]);
              setShowHistorySheet(false);
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${addMode
            ? 'bg-amber-500 text-white shadow-sm hover:bg-amber-600'
            : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
            }`}
        >
          <Plus className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${addMode ? 'rotate-45' : ''}`} />
          <span className="hidden sm:inline">{addMode ? 'Place Bin' : 'Add Bin'}</span>
        </button>

        <div className="w-px h-4 bg-gray-300/40 shrink-0" />

        {/* Create Route */}
        <button
          title={selectionMode ? 'Selecting bins for route' : 'Create Route'}
          onClick={() => {
            const nextSelect = !selectionMode;
            setSelectionMode(nextSelect);
            if (nextSelect) {
              setAddMode(false);
              setDeleteSelectionMode(false);
              clearSelectedBinIcons(selectedBinsToDelete);
              setSelectedBinsToDelete([]);
              setShowHistorySheet(false);
              clearRouteVisualization();
              setRouteStatus('');
              setRouteError('');
              setSelectedBins([]);
              setIsPlannerExpanded(true);
            } else {
              clearSelectedBinIcons(selectedBins);
              setSelectedBins([]);
              setIsPlannerExpanded(false);
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${selectionMode
            ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
            : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
            }`}
        >
          <Navigation className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{selectionMode ? 'Selecting...' : 'Route'}</span>
        </button>

        <div className="w-px h-4 bg-gray-300/40 shrink-0" />

        {/* Delete Bins */}
        <button
          title={deleteSelectionMode ? 'Selecting bins for deletion' : 'Delete Bins'}
          onClick={() => {
            const nextDelete = !deleteSelectionMode;
            setDeleteSelectionMode(nextDelete);
            if (nextDelete) {
              setAddMode(false);
              setSelectionMode(false);
              clearSelectedBinIcons(selectedBins);
              setSelectedBins([]);
              setShowHistorySheet(false);
              clearRouteVisualization();
              setRouteStatus('');
              setRouteError('');
              setSelectedBinsToDelete([]);
              setIsPlannerExpanded(true);
            } else {
              clearSelectedBinIcons(selectedBinsToDelete);
              setSelectedBinsToDelete([]);
              setIsPlannerExpanded(false);
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${deleteSelectionMode
            ? 'bg-red-600 text-white shadow-sm hover:bg-red-700'
            : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
            }`}
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{deleteSelectionMode ? 'Selecting...' : 'Delete Bins'}</span>
        </button>

        <div className="w-px h-4 bg-gray-300/40 shrink-0" />

        {/* Route History (includes route visibility controls) */}
        <button
          title="Route History"
          onClick={() => {
            const nextShow = !showHistorySheet;
            setShowHistorySheet(nextShow);
            if (nextShow) {
              setShowLegend(false);
              setAddMode(false);
              setSelectionMode(false);
              clearSelectedBinIcons(selectedBins);
              setSelectedBins([]);
              loadRouteHistory();
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${showHistorySheet
            ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
            : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
            }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">History</span>
        </button>

        {/* Focus Mode — only when a single council is active */}
        {council?.name && (
          <>
            <div className="w-px h-4 bg-gray-300/40 shrink-0" />
            <button
              title={focusMode ? 'Disable focus mask' : 'Enable focus mask'}
              onClick={() => setFocusMode(!focusMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${focusMode
                ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
                : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
                }`}
            >
              {focusMode ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              <span className="hidden sm:inline">{focusMode ? 'Focus' : 'Unfocused'}</span>
            </button>
          </>
        )}

        <div className="w-px h-4 bg-gray-300/40 shrink-0" />

        {/* Legend */}
        <button
          title="Map Legend"
          onClick={() => {
            const next = !showLegend;
            setShowLegend(next);
            if (next) setShowHistorySheet(false);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${showLegend
            ? 'bg-slate-800 text-white shadow-sm hover:bg-slate-900'
            : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
            }`}
        >
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Legend</span>
        </button>
      </div>

      {/* MAP LEGEND OVERLAY CARD */}
      {showLegend && (
        <div
          style={{ zIndex: 999 }}
          className="absolute top-20 right-4 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl shadow-2xl p-5 gap-3 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex justify-between items-center border-b border-white/20 pb-2 shrink-0">
            <span className="font-bold text-slate-800 text-sm">Map Legend</span>
            <button
              type="button"
              onClick={() => setShowLegend(false)}
              className="p-1 rounded-lg hover:bg-slate-200/50 text-slate-500 hover:text-slate-700 transition-colors text-xs"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-3 text-xs text-slate-700">
            {/* Bin markers — matches field-staff report statuses */}
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Bin markers (fill status)
            </span>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white shadow-sm shrink-0" />
                <span className="font-medium">Full — collect first</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#f59e0b] border border-white shadow-sm shrink-0" />
                <span className="font-medium">Half — needs collection</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#10b981] border border-white shadow-sm shrink-0" />
                <span className="font-medium">Empty — recently cleared</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#94a3b8] border border-white shadow-sm shrink-0" />
                <span className="font-medium">Not checked — no report yet</span>
              </div>
            </div>

            <hr className="border-white/20" />

            {/* Selection badges */}
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Selection mode
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm shrink-0" />
                <span>Green badge — bin selected for <strong>Route</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-red-500 border-2 border-white shadow-sm shrink-0" />
                <span>Red badge — bin selected for <strong>Delete</strong></span>
              </div>
            </div>

            <hr className="border-white/20" />

            {/* Routes — aligned with History visibility (W4) */}
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Collection routes
            </span>
            <p className="text-[10px] text-slate-500 leading-snug">
              Open <strong>History</strong> → tick <strong>Visible on map</strong> per session.
              Latest active route is shown by default; use Show all / Hide all for more.
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span
                  className="w-8 h-1 rounded shrink-0"
                  style={{ backgroundColor: ROUTE_COLORS[0] }}
                />
                <span className="font-medium">Active route (colour varies per session)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-11">
                {ROUTE_COLORS.slice(0, 4).map((c) => (
                  <span
                    key={c}
                    className="w-5 h-1 rounded shrink-0"
                    style={{ backgroundColor: c }}
                    title="Route session colour"
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-1 bg-slate-500 rounded shrink-0" />
                <span className="font-medium">Completed route</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-0.5 border-t-2 border-dashed border-emerald-500 shrink-0" />
                <span className="font-medium">Animated line — route in progress</span>
              </div>
            </div>

            <hr className="border-white/20" />

            {/* Map overlays */}
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Map overlays
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[#9333ea] border border-white shadow-sm shrink-0" />
                <span>Depot — route start / end point</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 h-0.5 border-t-2 border-emerald-500 shrink-0" />
                <span>Council boundary outline</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BIN DIALOG */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent style={{ zIndex: 10000 }} className="z-[10000] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Waste Bin</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBinSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Bin Code</label>
              <Input value={nextBinCode} disabled className="bg-gray-50 text-gray-500 font-semibold" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Location (Coordinates)</label>
              <Input placeholder="lat, lng" value={newBin.location}
                onChange={(e) => setNewBin({ ...newBin, location: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Zone</label>
              <Input type="number" min="1" placeholder="e.g. 1" value={newBin.zone}
                onChange={(e) => setNewBin({ ...newBin, zone: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Type</label>
              <Select value={newBin.type} onValueChange={(val) => setNewBin({ ...newBin, type: val })}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent style={{ zIndex: 99999 }}>
                  <SelectItem value="General Waste">General Waste</SelectItem>
                  <SelectItem value="Recyclables">Recyclables</SelectItem>
                  <SelectItem value="Organic Waste">Organic Waste</SelectItem>
                  <SelectItem value="Mixed Waste">Mixed Waste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-medium">Save Bin</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* COLLAPSIBLE ROUTE PLANNER BOTTOM DRAWER */}
      {selectionMode && (
        <div
          style={{ zIndex: 999 }}
          className={`absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 ease-in-out flex flex-col ${isPlannerExpanded ? 'h-[280px]' : 'h-14'
            }`}
        >
          {/* Header/Collapsed Panel Bar */}
          <div
            className="flex items-center justify-between px-6 h-14 border-b border-gray-100 shrink-0 cursor-pointer select-none bg-gray-50/50 hover:bg-gray-50/80 transition-colors"
            onClick={() => setIsPlannerExpanded(!isPlannerExpanded)}
          >
            <div className="flex items-center gap-3">
              {isPlannerExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-500 animate-bounce" />
              ) : (
                <ChevronUp className="w-5 h-5 text-gray-500 animate-bounce" />
              )}
              <span className="font-semibold text-gray-800 text-sm">Route Planner & Setup</span>
              <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {selectedBins.length} Bins Selected
              </span>
            </div>
            <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
              {!isPlannerExpanded && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold"
                  onClick={() => {
                    setSelectionMode(false);
                    clearSelectedBinIcons(selectedBins);
                    setSelectedBins([]);
                    setIsPlannerExpanded(false);
                  }}
                >
                  Cancel
                </Button>
              )}
              <button
                onClick={() => setIsPlannerExpanded(!isPlannerExpanded)}
                className="text-xs font-bold text-green-700 hover:text-green-800 transition-colors"
              >
                {isPlannerExpanded ? "Collapse" : "Expand Configuration"}
              </button>
            </div>
          </div>

          {/* Expanded Configuration Details */}
          {isPlannerExpanded && (
            <div className="p-5 flex flex-col md:flex-row gap-6 overflow-hidden flex-1 bg-white">
              {/* Left Column: Selected Bins Tag Chips */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selected Bins</span>
                {selectedBins.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50">
                    <MapPin className="w-6 h-6 text-gray-300 mb-1" />
                    <p className="text-gray-400 text-xs text-center">Click bins on the map to add them to this route</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[140px] p-2 border border-gray-100 rounded-xl bg-slate-50/50">
                    {selectedBins.map(id => {
                      const entry = markers.get(id);
                      return (
                        <div key={id} className="flex items-center gap-1.5 bg-white text-gray-800 px-3 py-1 rounded-full text-xs font-medium border border-gray-200 shadow-sm shrink-0">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR_MAP[entry?.data.status || 'not_checked'] }}></span>
                          <span>{entry?.data.binCode || id}</span>
                          <button
                            type="button"
                            onClick={() => toggleBinSelection(id)}
                            className="text-gray-400 hover:text-red-500 font-bold ml-1 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Setup Dropdowns and Actions */}
              <div className="w-full md:w-80 flex flex-col justify-between gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-500 mb-1 text-[10px] font-bold uppercase tracking-wider">Select Vehicle</label>
                    <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 shadow-sm transition-colors">
                      <option value="">-- Vehicle --</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.licensePlate || v.vehicleCode} (Cap: {v.capacity || 25})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1 text-[10px] font-bold uppercase tracking-wider">Select Driver</label>
                    <select value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600 shadow-sm transition-colors">
                      <option value="">-- Driver --</option>
                      {drivers.map(d => <option key={d.empId} value={d.empId}>{d.empName || 'Unnamed'}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-auto">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs h-10 border-gray-200"
                    onClick={() => {
                      clearSelectedBinIcons(selectedBins);
                      setSelectedBins([]);
                    }}
                  >
                    Clear All
                  </Button>
                  <Button
                    disabled={isGeneratingRoute}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold h-10 transition-all shadow-md disabled:opacity-50 flex items-center justify-center"
                    onClick={async () => {
                      if (selectedBins.length === 0) { toast.error("Please select at least one bin"); return; }
                      if (!selectedVehicleId) { toast.error("Please select a vehicle"); return; }
                      if (!selectedDriverId) { toast.error("Please select a driver"); return; }
                      const vehicle = vehicles.find(v => String(v.id) === selectedVehicleId);
                      const capacity = vehicle?.capacity || DEFAULT_VEHICLE_CAPACITY;
                      setIsGeneratingRoute(true);
                      try {
                        const selectedBinIds = selectedBins.map(id => Number(id)).filter(id => Number.isFinite(id));
                        const res = await fetch(ROUTE_SESSION_API, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            userId: getCurrentUserId(), vehicleCount: 1,
                            vehicleCapacities: [capacity],
                            depotLat: boundaryData?.depotLat ?? 6.775080,
                            depotLng: boundaryData?.depotLng ?? 79.882289,
                            selectedBinIds,
                            vehicleId: Number(selectedVehicleId),
                            driverId: Number(selectedDriverId)
                          })
                        });
                        if (!res.ok) { const errorText = await res.text(); throw new Error(errorText || 'Failed to create route session'); }
                        const snapshot = await res.json() as RouteSessionSnapshot;
                        setRouteStatus(snapshot.status || 'PROCESSING');
                        setRouteError('');
                        setActiveSessionId(snapshot.sessionId);
                        if (snapshot.status === 'READY') await visualizeRoutes(snapshot);
                        
                        // Prepend newly created route to history in real time
                        const driver = drivers.find(d => String(d.empId) === selectedDriverId);
                        const newRouteItem = {
                          id: Date.now(),
                          sessionId: snapshot.sessionId,
                          vehicleCode: vehicle?.licensePlate || vehicle?.vehicleCode || "Unknown",
                          driverName: driver?.empName || "Unnamed",
                          status: snapshot.status || "READY",
                          createdDate: new Date().toISOString()
                        };
                        setAssignedRoutes(prev => [newRouteItem, ...prev]);
                        loadRouteHistory();

                        connectRouteSocket(snapshot.sessionId);
                        setSelectionMode(false);
                        clearSelectedBinIcons(selectedBins);
                        setSelectedBins([]);
                        setIsPlannerExpanded(false);
                        toast.success("Route generated successfully!");
                      } catch (e) { 
                        console.error(e); 
                        toast.error("Error generating routes"); 
                      } finally {
                        setIsGeneratingRoute(false);
                      }
                    }}
                  >
                    {isGeneratingRoute ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Navigation className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {isGeneratingRoute ? "Generating..." : "Generate Route"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* COLLAPSIBLE BULK BIN DELETION BOTTOM DRAWER */}
      {deleteSelectionMode && (
        <div
          style={{ zIndex: 999 }}
          className={`absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 ease-in-out flex flex-col ${isPlannerExpanded ? 'h-[280px]' : 'h-14'
            }`}
        >
          {/* Header/Collapsed Panel Bar */}
          <div
            className="flex items-center justify-between px-6 h-14 border-b border-gray-100 shrink-0 cursor-pointer select-none bg-red-50/50 hover:bg-red-50/80 transition-colors"
            onClick={() => setIsPlannerExpanded(!isPlannerExpanded)}
          >
            <div className="flex items-center gap-3">
              {isPlannerExpanded ? (
                <ChevronDown className="w-5 h-5 text-red-500 animate-bounce" />
              ) : (
                <ChevronUp className="w-5 h-5 text-red-500 animate-bounce" />
              )}
              <span className="font-semibold text-gray-800 text-sm">Bulk Bin Deletion</span>
              <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {selectedBinsToDelete.length} Bins Selected for Deletion
              </span>
            </div>
            <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
              {!isPlannerExpanded && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold"
                  onClick={() => {
                    setDeleteSelectionMode(false);
                    clearSelectedBinIcons(selectedBinsToDelete);
                    setSelectedBinsToDelete([]);
                    setIsPlannerExpanded(false);
                  }}
                >
                  Cancel
                </Button>
              )}
              <button
                onClick={() => setIsPlannerExpanded(!isPlannerExpanded)}
                className="text-xs font-bold text-red-700 hover:text-red-800 transition-colors"
              >
                {isPlannerExpanded ? "Collapse" : "Expand Configuration"}
              </button>
            </div>
          </div>

          {/* Expanded Configuration Details */}
          {isPlannerExpanded && (
            <div className="p-5 flex flex-col md:flex-row gap-6 overflow-hidden flex-1 bg-white">
              {/* Left Column: Selected Bins Tag Chips */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bins to Delete</span>
                {selectedBinsToDelete.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50/50">
                    <Trash2 className="w-6 h-6 text-gray-300 mb-1" />
                    <p className="text-gray-400 text-xs text-center">Click bins on the map to add them to the deletion list</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[140px] p-2 border border-gray-100 rounded-xl bg-slate-50/50">
                    {selectedBinsToDelete.map(id => {
                      const entry = markers.get(id);
                      return (
                        <div key={id} className="flex items-center gap-1.5 bg-white text-gray-800 px-3 py-1 rounded-full text-xs font-medium border border-gray-200 shadow-sm shrink-0">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR_MAP[entry?.data.status || 'not_checked'] }}></span>
                          <span>{entry?.data.binCode || id}</span>
                          <button
                            type="button"
                            onClick={() => toggleDeleteBinSelection(id)}
                            className="text-gray-400 hover:text-red-500 font-bold ml-1 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Actions */}
              <div className="w-full md:w-80 flex flex-col justify-end gap-4">
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 text-xs h-10 border-gray-200"
                    onClick={() => {
                      clearSelectedBinIcons(selectedBinsToDelete);
                      setSelectedBinsToDelete([]);
                    }}
                  >
                    Clear All
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={selectedBinsToDelete.length === 0}
                    className="flex-1 text-xs h-10 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected Bins
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ROUTE HISTORY SIDE FLOATING PANEL */}
      <div
        style={{ zIndex: 999 }}
        className={`absolute right-4 top-20 bottom-4 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl shadow-2xl transition-all duration-300 transform ${showHistorySheet
          ? 'translate-x-0 opacity-100'
          : 'translate-x-[110%] opacity-0 pointer-events-none'
          }`}
      >
        <div className="p-5 border-b border-white/20 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-bold text-slate-800">Route History & Active Sessions</h3>
          </div>
          <button
            onClick={() => setShowHistorySheet(false)}
            className="p-1 rounded-lg hover:bg-slate-200/50 text-slate-500 hover:text-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* History filter tabs */}
        <div className="px-5 py-3 border-b border-white/20 bg-slate-50/20 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            {(['all', 'active', 'completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setHistoryTab(tab)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${historyTab === tab
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-white/55 text-slate-600 border border-slate-200/50 hover:bg-white/80'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {assignedRoutes.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </button>
          )}
        </div>

        {/* Hover Preview toggle switch */}
        <div className="px-5 py-3 border-b border-white/20 flex items-center justify-between text-xs font-medium text-slate-700 bg-green-50/10 shrink-0">
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-green-600" />
            Hover Cards to Preview on Map
          </span>
          <Switch checked={hoverPreview} onCheckedChange={setHoverPreview} />
        </div>

        {/* Map visibility — active routes only (W4, integrated into History) */}
        {loadedRouteSessions.length > 0 && (
          <div className="px-5 py-2.5 border-b border-white/20 flex items-center justify-between shrink-0 bg-slate-50/30">
            <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
              <RouteIcon className="w-3.5 h-3.5 text-green-600" />
              Routes on map
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={showAllRoutes}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-100"
              >
                Show all
              </button>
              <button
                type="button"
                onClick={hideAllRoutes}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              >
                Hide all
              </button>
            </div>
          </div>
        )}

        {/* List content container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loadingRoutes ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              <p className="text-gray-400 text-xs font-medium">Loading history...</p>
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center text-slate-400">
              <RouteIcon className="w-8 h-8 opacity-25" />
              <p className="text-xs">No {historyTab !== 'all' ? historyTab : ''} routes found</p>
            </div>
          ) : (
            filteredRoutes.map((r, i) => {
              const isActive = r.status !== 'COMPLETED' && r.status !== 'CANCELLED';
              const routeColor = getSessionColor(r.sessionId, i);
              const isVisibleOnMap = visibleSessionIds[r.sessionId] ?? false;
              return (
                <div
                  key={r.sessionId || r.id || i}
                  onMouseEnter={() => { if (hoverPreview) previewRouteSession(r.sessionId); }}
                  onMouseLeave={() => { if (hoverPreview) restoreRouteVisibility(); }}
                  className="border border-white/30 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-white/50 transition-all bg-white/60 hover:bg-white/85 relative overflow-hidden group"
                >
                  {/* Route color strip — matches map polyline when active */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: isActive ? routeColor : '#94a3b8' }}
                  />

                  <div className="flex justify-between items-start mb-2.5">
                    <span className="font-semibold text-slate-800 text-sm">Session #{r.id || i + 1}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${isActive
                      ? 'bg-emerald-50/70 text-emerald-700 border-emerald-100/50'
                      : 'bg-slate-50/70 text-slate-700 border-slate-200/50'
                      }`}>
                      {isActive ? 'Active' : 'Completed'}
                    </span>
                  </div>

                  {/* Per-route map visibility */}
                  <label
                    className="flex items-center gap-2 mb-3 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isVisibleOnMap}
                      onChange={(e) =>
                        toggleSessionVisibility(r.sessionId, e.target.checked)
                      }
                      className="rounded border-slate-300"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white shadow-sm"
                      style={{ backgroundColor: routeColor }}
                    />
                    <span className="text-[11px] font-medium text-slate-600">
                      Visible on map
                    </span>
                  </label>

                  <div className="text-[11px] text-slate-500 space-y-1.5 mb-3">
                    <div className="flex justify-between">
                      <span>Vehicle Code:</span>
                      <span className="font-medium text-slate-800">{r.vehicleCode || 'N/A'}</span>
                    </div>
                    {r.driverName && (
                      <div className="flex justify-between">
                        <span>Driver Name:</span>
                        <span className="font-medium text-slate-800">{r.driverName}</span>
                      </div>
                    )}
                    {r.createdDate && (
                      <div className="flex justify-between">
                        <span>Date Created:</span>
                        <span className="font-medium text-slate-800">{new Date(r.createdDate).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ROUTE SESSION STATUS FLOATING BANNER */}
      {(routeStatus || routeError || activeSessionId) && (
        <div
          style={{ zIndex: 999 }}
          className={`absolute ${selectionMode ? 'bottom-20' : 'bottom-4'
            } left-4 bg-white/95 border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-xs max-w-sm transition-all duration-300`}
        >
          <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Active Route Session
          </div>
          {activeSessionId && <div className="text-[10px] text-slate-500 font-mono">ID: {activeSessionId}</div>}
          {routeStatus && <div className="mt-1">Status: <span className="font-semibold text-emerald-700 uppercase">{routeStatus}</span></div>}
          {routeError && <div className="mt-1 text-red-600 font-medium">{routeError}</div>}
        </div>
      )}

      {/* CONTEXT MENU — appears on right-click of a bin marker */}
      {contextMenu && contextMenuPos && (
        <div style={{ top: contextMenuPos.y, left: contextMenuPos.x, zIndex: 9999, transform: 'translate(-50%, -105%)' }}
          className="absolute bg-white shadow-xl rounded-lg p-2.5 z-[2000] min-w-[190px] border border-gray-200 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] font-bold text-gray-400 px-2 py-0.5 uppercase tracking-wider flex justify-between items-center border-b border-gray-50 pb-1.5">
            <span>Manage Bin</span>
            <button onClick={() => setContextMenu(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="px-2 py-0.5">
            <label className="text-[10px] text-gray-500 font-bold block mb-1 uppercase tracking-wider">Priority</label>
            <select className="w-full text-xs border border-gray-200 rounded p-1.5 bg-gray-50 focus:ring focus:ring-green-200 outline-none"
              value={markers.get(contextMenu.binId)?.data.priority || 'medium'}
              onChange={(e) => updatePriority(contextMenu.binId, e.target.value as BinData['priority'])}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="px-2 py-0.5">
            <label className="text-[10px] text-gray-500 font-bold block mb-1 uppercase tracking-wider">Zone (Number)</label>
            <input type="number" min="1" placeholder="e.g. 1"
              className="w-full text-xs border border-gray-200 rounded p-1.5 bg-gray-50 focus:ring focus:ring-green-200 outline-none"
              value={markers.get(contextMenu.binId)?.data.zone || ''}
              onBlur={(e) => updateZone(contextMenu.binId, e.target.value)} // Persist on blur for a smoother UX
              onChange={(e) => updateBinLocally(contextMenu.binId, { zone: e.target.value })} // Update locally on each keystroke
              onKeyDown={(e) => { if (e.key === 'Enter') { updateZone(contextMenu.binId, e.currentTarget.value); setContextMenu(null); } }} // Also persist and close on Enter
            />
          </div>
          <hr className="my-1 border-gray-100" />
          <button onClick={() => removeBin(contextMenu.binId)}
            disabled={!canManageBin(contextMenu.binId)}
            title={!canManageBin(contextMenu.binId) ? 'You can only delete bins from your assigned council' : 'Delete this bin'}
            className="text-left px-2 py-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 rounded-md transition-colors font-bold flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
            Remove Bin
          </button>
        </div>
      )}
    </div>
  );
}
