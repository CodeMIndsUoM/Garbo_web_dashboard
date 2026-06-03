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
  X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Switch } from "./ui/switch";
import { GarboLoader } from "./GarboLoader";

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
const createBinIconHtml = (id: string, status: string = 'not_checked', fillLevel: number = 0, isSelected: boolean = false) => {
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
      <div class="absolute -top-1.5 -right-1.5 bg-green-500 text-white rounded-full border-2 border-white flex items-center justify-center shadow-lg" style="width: 17px; height: 17px; z-index: 10;">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      ` : ''}
    </div>
  `;
};

// Generates L.divIcon using the customized SVG bin content
const getStatusIcon = (id: string, status?: string, fillLevel?: number, isSelected?: boolean) => {
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
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);   // FeatureGroup holding all route polylines; cleared between optimisations
  const stompClientRef = useRef<Client | null>(null);           // Active STOMP client for the route WebSocket subscription
  const depotMarkerRef = useRef<L.Marker | null>(null);         // Reference to the depot marker for potential repositioning
  const turfPolyRef = useRef<ReturnType<typeof turfPolygon> | null>(null); // Turf polygon used for point-in-polygon boundary checks
  const boundaryLayerRef = useRef<L.FeatureGroup | null>(null);   // Holds the boundary outline polygons
  const maskLayerRef = useRef<L.Polygon | null>(null);        // Holds the inverted dimming mask polygon
  const prevCouncilRef = useRef<string | null>(null);           // Tracks the previously selected council name for animated transitions
  const allBoundsRef = useRef<L.LatLngBounds | null>(null);   // Cached combined bounds of all councils for zoom-out transitions

  const [council, setCouncil] = useState(initialCouncil);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    setCouncil(initialCouncil);
  }, [initialCouncil]);

  useEffect(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    setIsSuperAdmin(role?.toLowerCase() === 'superadmin' || role?.toLowerCase() === 'role_superadmin');
  }, []);

  const [focusMode, setFocusMode] = useState(true);               // Toggle visual dimming mask on/off

  // Council boundary state
  const [boundaryData, setBoundaryData] = useState<CouncilBoundaryDTO | null>(null); // API response for the council's boundary + depot
  const [boundaryLoading, setBoundaryLoading] = useState(true); // Prevents map initialisation before boundary is resolved

  const [markers, setMarkers] = useState<BinMarkersMap>(new Map()); // All rendered bin markers indexed by bin ID
  const [addMode, setAddMode] = useState(false); // When true, map clicks trigger new-bin placement
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, binId: string } | null>(null); // Right-click context menu state for a specific bin
  const [assignedRoutes, setAssignedRoutes] = useState<any[]>([]); // Routes previously assigned to the current user
  const [loadingRoutes, setLoadingRoutes] = useState(false); // Loading indicator for the assigned routes fetch
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false); // Controls the new-bin creation dialog
  const [newBin, setNewBin] = useState({ location: '', type: 'General Waste', zone: '' }); // Form state for the new bin dialog

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

  // Overhaul custom UI states
  const [isPlannerExpanded, setIsPlannerExpanded] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [councilTransitioning, setCouncilTransitioning] = useState(false);
  const [historyTab, setHistoryTab] = useState<'all' | 'active' | 'completed'>('all');
  const [hoverPreview, setHoverPreview] = useState(false);

  const canManageBin = (binId: string) => {
    const entry = markers.get(binId);
    if (!entry) return false;

    const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
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

  // Fetches vehicles and drivers whenever selection mode opens or the council changes
  useEffect(() => {
    const fetchResources = async () => {
      const token = localStorage.getItem('token');
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
          entry.marker.setIcon(getStatusIcon(id, entry.data.status, entry.data.fillLevel, !isSelected));
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
      if (entry) entry.marker.setIcon(getStatusIcon(id, entry.data.status, entry.data.fillLevel, false));
    });
  };

  // Removes all route polylines from the map without affecting bin markers
  const clearRouteVisualization = () => {
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
  const buildRoadPolyline = async (stops: RouteBinStop[], color: string, vehicleId: string, isCompleted: boolean = false) => {
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

    // Visual configurations based on completed vs active routes
    const routeColor = isCompleted ? '#16a34a' : '#10b981';
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
          .addTo(routeLayerRef.current!);
      });
    } catch {
      // Fallback: draw a straight-line polyline
      const clippedSegments = clipPolylineToCouncil(pathCoordinates);
      if (clippedSegments.length === 0) return;

      clippedSegments.forEach((segment, index) => {
        L.polyline(segment, {
          color: routeColor,
          weight: 3,
          opacity: 0.6,
          dashArray: isCompleted ? '8, 6' : '10, 10',
          className
        })
          .bindTooltip(`Vehicle ${vehicleId} (fallback${index > 0 ? ' continued' : ''})`)
          .addTo(routeLayerRef.current!);
      });
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

    // Determine route completed status
    const isCompleted = snapshot.status === 'COMPLETED';

    // Draw all vehicle polylines in parallel for faster rendering
    await Promise.all(routeEntries.map(async ([vehicleKey, vehicleRoute], index) => {
      const color = ROUTE_COLORS[index % ROUTE_COLORS.length]; // Cycle through the colour palette
      await buildRoadPolyline(vehicleRoute.binSequence || [], color, vehicleKey, isCompleted);
    }));
    if (routeLayerRef.current) {
      const bounds = routeLayerRef.current.getBounds();
      if (bounds.isValid()) leafletMapRef.current.fitBounds(bounds.pad(0.15)); // Pan + zoom to show all routes with padding
    }
  };

  // Lazy-load assigned routes from the API
  const loadRouteHistory = async () => {
    setLoadingRoutes(true);
    try {
      const userId = getCurrentUserId();
      const res = await fetch(`${API_ORIGIN}/api/route-sessions/user/${userId}/active`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.ok) {
        const json = await res.json();
        setAssignedRoutes(Array.isArray(json) ? json : (json.data || []));
      }
    } catch (e) {
      console.error('Failed to fetch assigned routes', e);
    } finally {
      setLoadingRoutes(false);
    }
  };

  // Visualizes a specific history/assigned session
  const visualizeSession = async (sessionId: string, clear = true) => {
    try {
      const res = await fetch(`${API_ORIGIN}/api/route-sessions/${sessionId}/routes`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (!res.ok) throw new Error('Failed to fetch routes');
      const json = await res.json();
      const vehicleRoutes = Array.isArray(json) ? json : (json.data || []);

      const fakeSnapshot: RouteSessionSnapshot = {
        sessionId, userId: 0, version: 0, status: 'READY',
        trigger: 'HISTORY_VIEW', selectedBinIds: [], addedBinIds: [], removedBinIds: [],
        route: {
          totalVehiclesUsed: vehicleRoutes.length,
          routes: Object.fromEntries(vehicleRoutes.map((vr: any, idx: number) => [
            vr.vehicleId ? String(vr.vehicleId) : `v-${sessionId}-${idx}`,
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
                durationFromPrevStopSeconds: s.durationFromPrevSeconds || s.durationFromPrevStopSeconds || 0,
              }))
            }
          ]))
        },
        message: null
      };
      await visualizeRoutesInternal(fakeSnapshot, clear);
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

    // Enable completely free map interaction and zoom
    const map = L.map(mapRef.current, {
      zoomControl: false           // Zoom controls added manually at bottom-right
    });

    leafletMapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { noWrap: true }).addTo(map);

    // Add zoom controls to the top right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initialize boundary and route layers
    boundaryLayerRef.current = L.featureGroup().addTo(map);
    routeLayerRef.current = L.featureGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      setContextMenu(null); // Dismiss any open context menu on map click
      if (!addModeRef.current) return; // Ignore clicks when not in add mode
      const pt = point([e.latlng.lng, e.latlng.lat]); // Turf point uses [lng, lat]

      // Detect which council this click falls inside
      let detectedCouncil: string | null = null;

      if (turfPolyRef.current) {
        if (booleanPointInPolygon(pt, turfPolyRef.current)) {
          detectedCouncil = council?.name || null;
        }
      } else {
        // Iterate through all 5 councils in allBoundariesData
        for (const [cName, cData] of Object.entries(allBoundariesData)) {
          const coords = cData.boundaryPoints.map((p: any) => [p.lng, p.lat]);
          coords.push(coords[0]);
          const poly = turfPolygon([coords]);
          if (booleanPointInPolygon(pt, poly)) {
            detectedCouncil = cName;
            break;
          }
        }
      }

      if (!detectedCouncil) {
        alert("Outside municipal area! Please click inside one of the council boundaries.");
        return;
      }

      // Pre-populate the form with the clicked coordinates and open the creation dialog
      setNewBin(prev => ({ ...prev, location: `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}` }));
      setIsCreateModalOpen(true);
      setAddMode(false); // Exit add mode after capturing a location
    });

    loadBins();          // Fetch and render existing bins from the API
    loadActiveSession(); // Restore any previously active route session for this user

    return () => {
      disconnectRouteSocket(); // Clean up WebSocket on component unmount
      if (routeLayerRef.current) routeLayerRef.current.clearLayers();
      if (boundaryLayerRef.current) boundaryLayerRef.current.clearLayers();
    };
  }, [boundaryLoading, boundaryData]);

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
      const worldOuterRing: [number, number][] = [[90, -180], [90, 180], [-90, 180], [-90, -180]];
      maskLayerRef.current = L.polygon([worldOuterRing, municipalCoords], {
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

          // Keep the loader visible for a minimum time so it feels intentional, then reveal
          setTimeout(() => {
            setCouncilTransitioning(false);
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
  }, [council, boundaryData, focusMode]);

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
    const res = await fetch(BINS_API);
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
    const isSelected = selectedBins.includes(data.id);
    const marker = L.marker([data.lat, data.lng], { icon: getStatusIcon(data.id, data.status, data.fillLevel, isSelected) })
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
      setNewBin({ location: '', type: 'General Waste', zone: '' });
    } catch (err) {
      const e = err as Error;
      alert(e.message || "Error creating bin");
    }
  };

  // Sends a DELETE request for the given bin and removes its marker from the map
  const removeBin = async (id: string) => {
    if (!canManageBin(id)) {
      alert('You can only manage bins from your assigned council.');
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
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to delete bin ${id}`;
      alert(message);
    }
  };

  // Applies partial updates to a bin's data and refreshes its icon/tooltip
  const updateBinLocally = (id: string, updates: Partial<BinData>) => {
    const entry = markers.get(id);
    if (!entry) return;
    const newData = { ...entry.data, ...updates };
    entry.data = newData;
    entry.marker.bindTooltip(renderTooltip(newData));
    const isSelected = selectedBins.includes(id);
    entry.marker.setIcon(getStatusIcon(id, newData.status, newData.fillLevel, isSelected));
    setMarkers(new Map(markers));
  };

  // Update bin priority in DB
  const updatePriority = async (id: string, priority: BinData['priority']) => {
    try {
      if (!canManageBin(id)) {
        alert('You can only manage bins from your assigned council.');
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
        alert('You can only manage bins from your assigned council.');
        return;
      }
      const res = await fetch(`${BINS_API}/${id}/zone?zone=${encodeURIComponent(zone)}`,
        { method: "PUT", headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Zone update failed: ${res.status}`);
      updateBinLocally(id, { zone });
    } catch (e) { console.error("Failed to update zone", e); }
  };

  // Restores any active route session for the current user on initial map load
  const loadActiveSession = async () => {
    try {
      const userId = getCurrentUserId();
      const res = await fetch(`${API_ORIGIN}/api/route-sessions/user/${userId}/active`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      if (res.ok) {
        const json = await res.json();
        const assignments = Array.isArray(json) ? json : (json.data || []).filter((x: any) => x.status !== 'COMPLETED' && x.status !== 'CANCELLED');
        if (assignments.length > 0) {
          setRouteStatus('READY');
          clearRouteVisualization();
          for (const assignment of assignments) {
            try {
              const routeRes = await fetch(`${API_ORIGIN}/api/route-sessions/${assignment.sessionId}/routes`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
              if (routeRes.ok) {
                const vRoutes = await routeRes.json();
                const vehicleRoutes = Array.isArray(vRoutes) ? vRoutes : (vRoutes.data || []);
                const fakeSnapshot: RouteSessionSnapshot = {
                  sessionId: assignment.sessionId, userId,
                  version: 0, status: 'READY', trigger: 'INITIAL_LOAD',
                  selectedBinIds: [], addedBinIds: [], removedBinIds: [],
                  route: {
                    totalVehiclesUsed: vehicleRoutes.length,
                    routes: Object.fromEntries(vehicleRoutes.map((vr: any, idx: number) => [
                      vr.vehicleId ? String(vr.vehicleId) : `v-${assignment.id}-${idx}`,
                      {
                        vehicleId: vr.vehicleId || idx,
                        capacity: vr.capacity, totalBins: vr.totalBins,
                        estimatedDurationSeconds: vr.estimatedDurationSeconds,
                        binSequence: (vr.binStops ?? []).map((s: any) => ({
                          stopOrder: s.stopOrder, binId: s.binId,
                          lat: s.lat, lng: s.lng,
                          durationFromPrevStopSeconds: s.durationFromPrevSeconds || s.durationFromPrevStopSeconds || 0,
                        }))
                      }
                    ]))
                  },
                  message: null
                };
                await visualizeRoutesInternal(fakeSnapshot, false);
              }
              if (assignment === assignments[0]) {
                setActiveSessionId(assignment.sessionId);
                connectRouteSocket(assignment.sessionId);
              }
            } catch (err) { console.error('Error loading assignment', assignment, err); }
          }
        }
      }
    } catch (e) { console.error('Failed to load active session on mount', e); }
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
        {/* Council Filter Dropdown or Static Badge */}
        {isSuperAdmin ? (
          <div className="flex items-center gap-1.5 bg-white/30 hover:bg-white/50 border border-white/20 rounded-xl px-2.5 py-1.5 transition-all shrink-0">
            <Layers className="w-3.5 h-3.5 text-green-600 shrink-0" />
            <select
              value={council?.name || 'all'}
              onChange={(e) => {
                const selectedName = e.target.value;
                if (selectedName === 'all') {
                  setCouncil(null);
                } else {
                  setCouncil({ name: selectedName });
                }
              }}
              className="bg-transparent border-none text-[11px] font-semibold text-slate-700 outline-none cursor-pointer min-w-0 max-w-[160px] truncate"
            >
              <option value="all">All Councils</option>
              <option value="Colombo">Colombo</option>
              <option value="Dehiwala-Mt. Lavinia">Dehiwala-Mt. Lavinia</option>
              <option value="Kaduwela">Kaduwela</option>
              <option value="Moratuwa">Moratuwa</option>
              <option value="Sri Jayewardenepura Kotte">Sri J. Kotte</option>
            </select>
          </div>
        ) : (
          council?.name && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-emerald-50/80 text-emerald-700 border border-emerald-200/40 rounded-xl text-[11px] font-semibold shrink-0">
              <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate max-w-[120px]">{council.name}</span>
            </div>
          )
        )}

        {(isSuperAdmin || council?.name) && <div className="w-px h-5 bg-gray-300/40 shrink-0" />}

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

        {/* Route History */}
        <button
          title="Route History"
          onClick={() => {
            const nextShow = !showHistorySheet;
            setShowHistorySheet(nextShow);
            if (nextShow) {
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
          onClick={() => setShowLegend(!showLegend)}
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
        <div style={{ zIndex: 999 }} className="absolute top-16 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-xl p-5 w-72 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <span className="font-semibold text-gray-800 text-sm">Map Legend</span>
            <button onClick={() => setShowLegend(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>

          <div className="flex flex-col gap-3">
            {/* Bin Status colors */}
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bin Fill Status</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white shadow-sm"></span>
                <span className="text-gray-700 font-medium">Full (&gt;80%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#f59e0b] border border-white shadow-sm"></span>
                <span className="text-gray-700 font-medium">Half (30-80%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#10b981] border border-white shadow-sm"></span>
                <span className="text-gray-700 font-medium">Empty (&lt;30%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#94a3b8] border border-white shadow-sm"></span>
                <span className="text-gray-700 font-medium">Not Checked</span>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Route Status representation */}
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Route Status</span>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="w-8 h-1 bg-green-600 rounded"></span>
                <span className="text-gray-700 font-medium">Completed Route</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-1 bg-emerald-500 rounded border-t border-dashed"></span>
                <span className="text-gray-700 font-medium flex items-center gap-1.5">
                  Active/In Progress
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                </span>
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
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold h-10 transition-all shadow-md"
                    onClick={async () => {
                      if (selectedBins.length === 0) { alert("Please select at least one bin"); return; }
                      if (!selectedVehicleId) { alert("Please select a vehicle"); return; }
                      if (!selectedDriverId) { alert("Please select a driver"); return; }
                      const vehicle = vehicles.find(v => String(v.id) === selectedVehicleId);
                      const capacity = vehicle?.capacity || DEFAULT_VEHICLE_CAPACITY;
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
                        connectRouteSocket(snapshot.sessionId);
                        setSelectionMode(false);
                        clearSelectedBinIcons(selectedBins);
                        setSelectedBins([]);
                        setIsPlannerExpanded(false);
                      } catch (e) { console.error(e); alert("Error generating routes"); }
                    }}
                  >
                    <Navigation className="w-3.5 h-3.5 mr-1.5" />
                    Generate Route
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
        <div className="px-5 py-3 border-b border-white/20 bg-slate-50/20 flex gap-2 shrink-0">
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

        {/* Hover Preview toggle switch */}
        <div className="px-5 py-3 border-b border-white/20 flex items-center justify-between text-xs font-medium text-slate-700 bg-green-50/10 shrink-0">
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-green-600" />
            Hover Cards to Preview on Map
          </span>
          <Switch checked={hoverPreview} onCheckedChange={setHoverPreview} />
        </div>

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
              return (
                <div
                  key={r.sessionId || r.id || i}
                  onMouseEnter={() => { if (hoverPreview) visualizeSession(r.sessionId); }}
                  onMouseLeave={() => { if (hoverPreview) clearRouteVisualization(); }}
                  onClick={() => { if (!hoverPreview) visualizeSession(r.sessionId); }}
                  className="border border-white/30 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-white/50 transition-all bg-white/60 hover:bg-white/85 relative overflow-hidden group cursor-pointer"
                >
                  {/* Visual left bar color strip */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />

                  <div className="flex justify-between items-start mb-2.5">
                    <span className="font-semibold text-slate-800 text-sm">Session #{r.id || i + 1}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${isActive
                      ? 'bg-emerald-50/70 text-emerald-700 border-emerald-100/50'
                      : 'bg-slate-50/70 text-slate-700 border-slate-200/50'
                      }`}>
                      {isActive ? 'Active' : 'Completed'}
                    </span>
                  </div>

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
                        <span className="font-medium text-slate-800">{new Date(r.createdDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {!hoverPreview && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-semibold h-8 bg-white/80 border-slate-200/50 hover:bg-white"
                      onClick={(e) => { e.stopPropagation(); visualizeSession(r.sessionId); }}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Show on Map
                    </Button>
                  )}
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
      {contextMenu && (
        <div style={{ top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
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
