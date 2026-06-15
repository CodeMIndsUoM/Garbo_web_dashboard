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
import { AddBinGlassModal } from "./bin/AddBinGlassModal";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { Switch } from "./ui/switch";
import { GarboLoader } from "./GarboLoader";
import { MapSidePanel } from "./map/MapSidePanel";
import { useCouncil } from "@/lib/council-context";
import { useBinRealtime } from "@/hooks/useBinRealtime";
import { applyCollectionVisualUpdate, normalizeBinStatus } from "@/lib/bin-realtime";
import { toast } from "sonner";
import {
  DEFAULT_VEHICLE_MAX_BINS,
  getVehicleMaxBins,
  isVehicleCapacitySufficient,
  vehicleCapacityLabel,
} from "@/lib/vehicle-capacity";

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081'; // Base URL for all API calls; overridable via env
const BINS_API = `${API_ORIGIN}/api/bins`; // REST endpoint for bin CRUD operations
const ROUTE_SESSION_API = `${API_ORIGIN}/api/route-sessions`; // REST endpoint for route session management
const AUTO_ROUTE_PREVIEW_API = `${ROUTE_SESSION_API}/auto-preview`;
const ROUTE_COLORS = ['#16a34a', '#2563eb', '#ea580c', '#7c3aed', '#db2777', '#0891b2']; // Distinct colors cycled per vehicle route

// Maps bin fill status strings to their corresponding indicator colors
const STATUS_COLOR_MAP: Record<string, string> = {
  full: '#ef4444',       // Red — bin needs immediate collection
  half: '#f59e0b',       // Amber — bin is partially filled
  empty: '#10b981',      // Green — bin has been emptied
  not_checked: '#94a3b8' // Grey — bin status is unknown
};

// Generates beautiful custom SVG bin HTML based on status, fill level, and selection state
const createBinIconHtml = (id: string, status: string = 'not_checked', fillLevel: number = 0, isSelected: 'route' | 'delete' | boolean = false, hasDiscrepancy: boolean = false) => {
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
      ${hasDiscrepancy ? `
      <div class="absolute -top-1.5 -left-1.5 bg-amber-500 text-white rounded-full border-2 border-white flex items-center justify-center shadow-lg" style="width: 17px; height: 17px; z-index: 10;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="8" x2="12" y2="13"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      ` : ''}
    </div>
  `;
};

// Generates L.divIcon using the customized SVG bin content
const getStatusIcon = (id: string, status?: string, fillLevel?: number, isSelected?: 'route' | 'delete' | boolean, hasDiscrepancy?: boolean) => {
  return L.divIcon({
    html: createBinIconHtml(id, status, fillLevel, isSelected, hasDiscrepancy),
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
  assignedToEmpId?: number;
  assignedToName?: string;
  hasDiscrepancy?: boolean;
  discrepancyStatus?: string;
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

interface DraftRoute {
  draftId: string;
  binIds: number[];
  binCount: number;
  suggestedZone?: string | null;
}

interface AutoRoutePreview {
  totalBinsNeedingCollection: number;
  fleetSummary: { availableVehicles: number; totalMaxBins: number };
  draftRoutes: DraftRoute[];
  warnings: string[];
}

interface DraftAssignment {
  vehicleId: string;
  driverId: string;
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
  const { isSuperadmin, selectedCouncilId, setSelectedCouncilId, councils } = useCouncil();

  const mapRef = useRef<HTMLDivElement | null>(null);   // DOM node that Leaflet mounts into
  const leafletMapRef = useRef<L.Map | null>(null);            // Leaflet map instance; null before initialisation
  const addModeRef = useRef(false);                         // Ref mirror of addMode — readable inside map event closures without stale state
  const routeLayerRef = useRef<L.FeatureGroup | null>(null);   // Parent layer group for all route sessions
  const draftPreviewLayerRef = useRef<L.FeatureGroup | null>(null); // Auto-route draft preview polylines
  const draftHighlightedBinIdsRef = useRef<Set<string>>(new Set());
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
  const [newBin, setNewBin] = useState({
    location: '',
    type: 'General Waste',
    zone: '',
    council: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  }); // Form state for the new bin dialog

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
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [routePlannerTab, setRoutePlannerTab] = useState<'manual' | 'auto'>('manual');
  const [autoRouteLoading, setAutoRouteLoading] = useState(false);
  const [autoRoutePreview, setAutoRoutePreview] = useState<AutoRoutePreview | null>(null);
  const [draftAssignments, setDraftAssignments] = useState<Record<string, DraftAssignment>>({});
  const [focusedDraftId, setFocusedDraftId] = useState<string | null>(null);
  const [confirmingDraftId, setConfirmingDraftId] = useState<string | null>(null);
  const [confirmedDraftIds, setConfirmedDraftIds] = useState<string[]>([]);
  const [councilTransitioning, setCouncilTransitioning] = useState(false);
  const [historyTab, setHistoryTab] = useState<'all' | 'active' | 'completed'>('all');
  const [hoverPreview, setHoverPreview] = useState(false);
  const [loadedRouteSessions, setLoadedRouteSessions] = useState<LoadedRouteSession[]>([]);
  const [visibleSessionIds, setVisibleSessionIds] = useState<Record<string, boolean>>({});
  const [mentors, setMentors] = useState<{ empId: number; empName?: string }[]>([]);
  const [routeComplaintIds, setRouteComplaintIds] = useState<number[]>([]);
  const [routePrefill, setRoutePrefill] = useState<{ complaintIds?: number[]; lat?: number; lng?: number } | null>(null);

  const ZONE_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'unassigned'];

  useEffect(() => {
    visibleSessionIdsRef.current = visibleSessionIds;
  }, [visibleSessionIds]);

  useEffect(() => {
    const raw = sessionStorage.getItem('garbo_route_prefill');
    if (!raw) return;
    sessionStorage.removeItem('garbo_route_prefill');
    try {
      setRoutePrefill(JSON.parse(raw));
    } catch {
      setRoutePrefill(null);
    }
  }, []);

  useEffect(() => {
    if (!routePrefill || markers.size === 0) return;
    setSelectionMode(true);
    setShowRoutePlanner(true);
    setRoutePlannerTab('manual');
    if (Array.isArray(routePrefill.complaintIds)) {
      setRouteComplaintIds(routePrefill.complaintIds);
    }
    const fullBinIds = Array.from(markers.entries())
      .filter(([, entry]) => entry.data.status === 'full')
      .slice(0, 8)
      .map(([id]) => id);
    if (fullBinIds.length > 0) {
      setSelectedBins(fullBinIds);
    }
    toast.info('Route planner opened with complaint stop and nearby full bins');
    setRoutePrefill(null);
  }, [routePrefill, markers]);

  useEffect(() => {
    const loadMentors = async () => {
      try {
        const councilQuery = council?.name ? `?council=${encodeURIComponent(council.name)}` : '';
        const res = await fetch(`${API_ORIGIN}/api/admins/staff${councilQuery}`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) return;
        const json = await res.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        setMentors(list.filter((s: any) => String(s.role || '').toUpperCase().includes('MENTOR')));
      } catch {
        setMentors([]);
      }
    };
    void loadMentors();
  }, [council?.name]);

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

  const refetchRouteResources = async () => {
    const token = sessionStorage.getItem('token');
    const authHeaders = (token ? { Authorization: `Bearer ${token}` } : {}) as Record<string, string>;
    const councilQuery = council?.name ? `?council=${encodeURIComponent(council.name)}` : '';
    try {
      const [vehRes, drvRes] = await Promise.all([
        fetch(`${API_ORIGIN}/api/route-sessions/available-vehicles${councilQuery}`, { headers: authHeaders }),
        fetch(`${API_ORIGIN}/api/route-sessions/available-drivers${councilQuery}`, { headers: authHeaders }),
      ]);
      if (vehRes.ok) {
        const j = await vehRes.json();
        if (j.success) setVehicles(j.data);
      }
      if (drvRes.ok) {
        const j = await drvRes.json();
        if (j.success) setDrivers(j.data);
      }
    } catch (e) {
      console.error('Failed to fetch routing resources', e);
    }
  };

  // Fetches vehicles and drivers whenever route planner opens or council changes
  useEffect(() => {
    if (!showRoutePlanner) return;
    void refetchRouteResources();
  }, [showRoutePlanner, council?.name]);

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
          item.marker.setIcon(getStatusIcon(id, item.data.status, item.data.fillLevel, !isSelected ? 'route' : false, item.data.hasDiscrepancy));
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
          item.marker.setIcon(getStatusIcon(id, item.data.status, item.data.fillLevel, !isSelected ? 'delete' : false, item.data.hasDiscrepancy));
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
      if (entry) entry.marker.setIcon(getStatusIcon(id, entry.data.status, entry.data.fillLevel, false, entry.data.hasDiscrepancy));
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

  const clearDraftRoutePreview = () => {
    if (draftPreviewLayerRef.current) {
      draftPreviewLayerRef.current.clearLayers();
    }
    for (const id of draftHighlightedBinIdsRef.current) {
      const entry = markers.get(id);
      if (entry && !selectedBins.includes(id) && !selectedBinsToDelete.includes(id)) {
        entry.marker.setIcon(
          getStatusIcon(id, entry.data.status, entry.data.fillLevel, false, entry.data.hasDiscrepancy)
        );
      }
    }
    draftHighlightedBinIdsRef.current.clear();
  };

  const applyDraftBinHighlights = (
    preview: AutoRoutePreview,
    focusId: string | null,
    confirmed: string[]
  ) => {
    for (const id of draftHighlightedBinIdsRef.current) {
      const entry = markers.get(id);
      if (entry && !selectedBins.includes(id) && !selectedBinsToDelete.includes(id)) {
        entry.marker.setIcon(
          getStatusIcon(id, entry.data.status, entry.data.fillLevel, false, entry.data.hasDiscrepancy)
        );
      }
    }
    draftHighlightedBinIdsRef.current.clear();

    const drafts = preview.draftRoutes.filter((d) => !confirmed.includes(d.draftId));
    const toHighlight = focusId
      ? drafts.filter((d) => d.draftId === focusId)
      : drafts;

    for (const draft of toHighlight) {
      for (const binId of draft.binIds) {
        const id = String(binId);
        const entry = markers.get(id);
        if (entry) {
          entry.marker.setIcon(
            getStatusIcon(id, entry.data.status, entry.data.fillLevel, 'route', entry.data.hasDiscrepancy)
          );
          draftHighlightedBinIdsRef.current.add(id);
        }
      }
    }
  };

  // Road-snapped route line (OSRM) clipped to council boundary via Turf — same as confirmed routes
  const drawRoadSnappedPath = async (
    pathCoordinates: [number, number][],
    targetLayer: L.FeatureGroup,
    options: {
      color: string;
      weight?: number;
      opacity?: number;
      dashArray?: string;
      className?: string;
      tooltip?: string;
      isCompleted?: boolean;
    }
  ) => {
    if (!leafletMapRef.current || pathCoordinates.length < 2) return;

    const routeColor = options.isCompleted ? '#475569' : options.color;
    const className = options.isCompleted ? '' : (options.className ?? 'animate-route-flow');
    const dashArray = options.isCompleted ? undefined : (options.dashArray ?? '10, 10');
    const osrmCoordString = pathCoordinates.map(([lat, lng]) => `${lng},${lat}`).join(';');

    try {
      const osrmRes = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${osrmCoordString}?overview=full&geometries=geojson`
      );
      if (!osrmRes.ok) throw new Error('OSRM request failed');
      const osrmJson = await osrmRes.json();
      const coords = osrmJson?.routes?.[0]?.geometry?.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length === 0) throw new Error('No OSRM geometry');
      const latLngs: [number, number][] = coords.map((c: [number, number]) => [c[1], c[0]]);
      const clippedSegments = clipPolylineToCouncil(latLngs);
      clippedSegments.forEach((segment, index) => {
        L.polyline(segment, {
          color: routeColor,
          weight: options.weight ?? 5,
          opacity: options.opacity ?? 0.85,
          className,
          dashArray,
        })
          .bindTooltip(`${options.tooltip ?? 'Route'}${index > 0 ? ' (continued)' : ''}`)
          .addTo(targetLayer);
      });
    } catch {
      const clippedSegments = clipPolylineToCouncil(pathCoordinates);
      clippedSegments.forEach((segment, index) => {
        L.polyline(segment, {
          color: routeColor,
          weight: options.weight ?? 4,
          opacity: options.opacity ?? 0.75,
          dashArray,
          className,
        })
          .bindTooltip(`${options.tooltip ?? 'Route'} (fallback${index > 0 ? ' continued' : ''})`)
          .addTo(targetLayer);
      });
    }
  };

  const renderDraftRoutesOnMap = async (
    preview: AutoRoutePreview,
    focusId: string | null,
    confirmed: string[]
  ) => {
    if (!leafletMapRef.current || !draftPreviewLayerRef.current) return;

    draftPreviewLayerRef.current.clearLayers();
    applyDraftBinHighlights(preview, focusId, confirmed);

    const depotLat = boundaryData?.depotLat ?? 6.775080;
    const depotLng = boundaryData?.depotLng ?? 79.882289;
    const bounds = L.latLngBounds([[depotLat, depotLng]]);

    const activeDrafts = preview.draftRoutes.filter((d) => !confirmed.includes(d.draftId));
    const draftsToShow = focusId
      ? activeDrafts.filter((d) => d.draftId === focusId)
      : activeDrafts;

    await Promise.all(
      draftsToShow.map(async (draft) => {
        const routeIndex = activeDrafts.findIndex((d) => d.draftId === draft.draftId);
        const routeLabel = routeIndex >= 0 ? routeIndex + 1 : 1;
        const color = ROUTE_COLORS[Math.max(routeIndex, 0) % ROUTE_COLORS.length];
        const stops: [number, number][] = [];

        for (const binId of draft.binIds) {
          const entry = markers.get(String(binId));
          if (entry?.data.lat && entry?.data.lng) {
            stops.push([entry.data.lat, entry.data.lng]);
            bounds.extend([entry.data.lat, entry.data.lng]);
          }
        }

        if (stops.length === 0) return;

        L.circleMarker([depotLat, depotLng], {
          radius: 9,
          color: '#7c3aed',
          fillColor: '#7c3aed',
          fillOpacity: 0.9,
          weight: 3,
        })
          .bindTooltip('Depot (start / end)')
          .addTo(draftPreviewLayerRef.current!);

        const path: [number, number][] = [[depotLat, depotLng], ...stops, [depotLat, depotLng]];
        await drawRoadSnappedPath(path, draftPreviewLayerRef.current!, {
          color,
          weight: 6,
          opacity: 0.95,
          dashArray: '12, 8',
          className: 'animate-route-flow',
          tooltip: `Route ${routeLabel} · ${draft.binCount} bins`,
        });

        stops.forEach(([lat, lng], stopIdx) => {
          const stopNum = stopIdx + 1;
          const numberedIcon = L.divIcon({
            className: 'draft-stop-marker',
            html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)">${stopNum}</span>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          L.marker([lat, lng], { icon: numberedIcon, zIndexOffset: 500 })
            .bindTooltip(`Stop ${stopNum}`)
            .addTo(draftPreviewLayerRef.current!);
        });
      })
    );

    if (bounds.isValid() && draftsToShow.length > 0) {
      leafletMapRef.current.fitBounds(bounds.pad(0.12), { animate: true, maxZoom: 16 });
    }
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

  const closeMapSidePanels = (except?: 'history' | 'legend' | 'routePlanner') => {
    if (except !== 'history') setShowHistorySheet(false);
    if (except !== 'legend') setShowLegend(false);
    if (except !== 'routePlanner') {
      setShowRoutePlanner(false);
      setRoutePlannerTab('manual');
      setSelectionMode(false);
      setAutoRoutePreview(null);
      setDraftAssignments({});
      setFocusedDraftId(null);
      setConfirmedDraftIds([]);
      clearDraftRoutePreview();
      clearSelectedBinIcons(selectedBins);
      setSelectedBins([]);
    }
  };

  const closeRoutePlanner = () => {
    setShowRoutePlanner(false);
    setRoutePlannerTab('manual');
    setSelectionMode(false);
    setAutoRoutePreview(null);
    setDraftAssignments({});
    setFocusedDraftId(null);
    setConfirmedDraftIds([]);
    clearDraftRoutePreview();
    clearSelectedBinIcons(selectedBins);
    setSelectedBins([]);
  };

  const loadAutoRoutePreview = async () => {
    const councilName = council?.name;
    if (!councilName) {
      toast.error('Select a council first');
      return;
    }
    setAutoRouteLoading(true);
    try {
      const res = await fetch(AUTO_ROUTE_PREVIEW_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          council: councilName,
          minFillStatus: ['full', 'half'],
          useZones: true,
        }),
      });
      if (!res.ok) {
        const raw = await res.text();
        let message = 'Auto route preview failed';
        try {
          const body = JSON.parse(raw) as { error?: string; message?: string };
          message = body.error || body.message || message;
        } catch {
          if (raw) message = raw;
        }
        throw new Error(message);
      }
      const preview = (await res.json()) as AutoRoutePreview;
      setAutoRoutePreview(preview);
      const initial: Record<string, DraftAssignment> = {};
      for (const d of preview.draftRoutes) {
        initial[d.draftId] = { vehicleId: '', driverId: '' };
      }
      setDraftAssignments(initial);
      setConfirmedDraftIds([]);
      setFocusedDraftId(preview.draftRoutes[0]?.draftId ?? null);
      if (preview.draftRoutes.length === 0) {
        toast.warning('No route drafts generated — check bins and vehicles');
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Could not generate auto route preview');
    } finally {
      setAutoRouteLoading(false);
    }
  };

  const openRoutePlanner = (tab: 'manual' | 'auto' = 'manual') => {
    if (!council?.name) {
      toast.error('Select a council first');
      return;
    }
    closeMapSidePanels('routePlanner');
    setAddMode(false);
    setDeleteSelectionMode(false);
    clearSelectedBinIcons(selectedBinsToDelete);
    setSelectedBinsToDelete([]);
    setShowRoutePlanner(true);
    setRoutePlannerTab(tab);
    if (tab === 'manual') {
      setSelectionMode(true);
      setAutoRoutePreview(null);
      setSelectedBins([]);
    } else {
      setSelectionMode(false);
      clearSelectedBinIcons(selectedBins);
      setSelectedBins([]);
      setAutoRoutePreview(null);
      setConfirmedDraftIds([]);
      setFocusedDraftId(null);
      clearDraftRoutePreview();
    }
  };

  const switchRoutePlannerTab = (tab: 'manual' | 'auto') => {
    if (tab === routePlannerTab) return;
    setRoutePlannerTab(tab);
    if (tab === 'manual') {
      setSelectionMode(true);
      setAutoRoutePreview(null);
      setDraftAssignments({});
      setConfirmedDraftIds([]);
      setFocusedDraftId(null);
      clearDraftRoutePreview();
    } else {
      setSelectionMode(false);
      clearSelectedBinIcons(selectedBins);
      setSelectedBins([]);
      setAutoRoutePreview(null);
      setConfirmedDraftIds([]);
      setFocusedDraftId(null);
      clearDraftRoutePreview();
    }
  };

  const createRouteSession = async (
    selectedBinIds: number[],
    vehicleId: string,
    driverId: string
  ) => {
    const vehicle = vehicles.find((v) => String(v.id) === vehicleId);
    const capacity = vehicle ? getVehicleMaxBins(vehicle) : DEFAULT_VEHICLE_MAX_BINS;
    const res = await fetch(ROUTE_SESSION_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        userId: getCurrentUserId(),
        vehicleCount: 1,
        vehicleCapacities: [capacity],
        depotLat: boundaryData?.depotLat ?? 6.775080,
        depotLng: boundaryData?.depotLng ?? 79.882289,
        selectedBinIds,
        vehicleId: Number(vehicleId),
        driverId: Number(driverId),
        ...(routeComplaintIds.length > 0 ? { complaintIds: routeComplaintIds } : {}),
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || 'Failed to create route session');
    }
    const snapshot = (await res.json()) as RouteSessionSnapshot;
    setRouteStatus(snapshot.status || 'PROCESSING');
    setRouteError('');
    setActiveSessionId(snapshot.sessionId);
    if (snapshot.status === 'READY') await visualizeRoutes(snapshot);
    const driver = drivers.find((d) => String(d.empId) === driverId);
    const newRouteItem = {
      id: Date.now(),
      sessionId: snapshot.sessionId,
      vehicleCode: vehicle?.licensePlate || vehicle?.vehicleCode || 'Unknown',
      driverName: driver?.empName || 'Unnamed',
      status: snapshot.status || 'READY',
      createdDate: new Date().toISOString(),
    };
    setAssignedRoutes((prev) => [newRouteItem, ...prev]);
    loadRouteHistory();
    connectRouteSocket(snapshot.sessionId);
    setRouteComplaintIds([]);
    return snapshot;
  };

  const handleGenerateManualRoute = async () => {
    if (selectedBins.length === 0) {
      toast.error('Please select at least one bin');
      return;
    }
    if (!selectedVehicleId) {
      toast.error('Please select a vehicle');
      return;
    }
    if (!selectedDriverId) {
      toast.error('Please select a driver');
      return;
    }
    const vehicle = vehicles.find((v) => String(v.id) === selectedVehicleId);
    if (vehicle && !isVehicleCapacitySufficient(vehicle, selectedBins.length)) {
      toast.error(`Vehicle capacity too low (needs ${selectedBins.length} bins)`);
      return;
    }
    setIsGeneratingRoute(true);
    try {
      const selectedBinIds = selectedBins.map((id) => Number(id)).filter((id) => Number.isFinite(id));
      await createRouteSession(selectedBinIds, selectedVehicleId, selectedDriverId);
      closeRoutePlanner();
      toast.success('Route generated successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Error generating routes');
    } finally {
      setIsGeneratingRoute(false);
    }
  };

  const handleConfirmSingleDraft = async (draft: DraftRoute, routeLabel: string) => {
    const assignment = draftAssignments[draft.draftId];
    if (!assignment?.vehicleId) {
      toast.error(`Select a vehicle for ${routeLabel}`);
      return;
    }
    if (!assignment?.driverId) {
      toast.error(`Select a driver for ${routeLabel}`);
      return;
    }
    const vehicle = vehicles.find((v) => String(v.id) === assignment.vehicleId);
    if (vehicle && !isVehicleCapacitySufficient(vehicle, draft.binCount)) {
      toast.error(`${routeLabel}: vehicle capacity too low (${draft.binCount} bins)`);
      return;
    }
    setConfirmingDraftId(draft.draftId);
    try {
      await createRouteSession(draft.binIds, assignment.vehicleId, assignment.driverId);
      setConfirmedDraftIds((prev) => {
        const next = [...prev, draft.draftId];
        const remaining = (autoRoutePreview?.draftRoutes ?? []).filter(
          (d) => !next.includes(d.draftId)
        );
        if (remaining.length === 0) {
          setTimeout(() => closeRoutePlanner(), 0);
        } else {
          setFocusedDraftId(remaining[0]?.draftId ?? null);
        }
        return next;
      });
      toast.success(`${routeLabel} confirmed and optimized`);
      await refetchRouteResources();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to confirm ${routeLabel}`);
    } finally {
      setConfirmingDraftId(null);
    }
  };

  const remainingDraftRoutes = useMemo(() => {
    if (!autoRoutePreview) return [];
    return autoRoutePreview.draftRoutes.filter((d) => !confirmedDraftIds.includes(d.draftId));
  }, [autoRoutePreview, confirmedDraftIds]);

  const focusedDraftIndex = useMemo(() => {
    if (!focusedDraftId) return -1;
    return remainingDraftRoutes.findIndex((d) => d.draftId === focusedDraftId);
  }, [remainingDraftRoutes, focusedDraftId]);

  const renderVehicleOptions = (requiredBins: number, selectedId: string) => (
    <>
      <option value="">-- Vehicle --</option>
      {vehicles.map((v) => {
        const sufficient = isVehicleCapacitySufficient(v, requiredBins);
        const label = `${v.licensePlate || v.vehicleCode} (${vehicleCapacityLabel(v)})`;
        return (
          <option
            key={v.id}
            value={v.id}
            disabled={!sufficient}
            title={
              sufficient
                ? label
                : `Not enough capacity (needs ${requiredBins}, max ${getVehicleMaxBins(v)})`
            }
            className={sufficient ? '' : 'text-muted-foreground'}
          >
            {sufficient ? label : `${label} — insufficient`}
          </option>
        );
      })}
    </>
  );

  const routeSessionFooter =
    routeStatus || routeError || activeSessionId ? (
      <div className="text-xs text-[var(--glass-text)] space-y-1">
        <div className="font-semibold text-[var(--glass-text)] flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          Active Route Session
        </div>
        {activeSessionId && (
          <div className="text-[10px] text-[var(--glass-text-muted)] font-mono truncate">ID: {activeSessionId}</div>
        )}
        {routeStatus && (
          <div>
            Status:{' '}
            <span className="font-semibold text-emerald-700 uppercase">{routeStatus}</span>
          </div>
        )}
        {routeError && <div className="text-red-600 font-medium">{routeError}</div>}
      </div>
    ) : null;

  // Builds a road-snapped polyline for one vehicle's stops (confirmed / history routes)
  const buildRoadPolyline = async (
    stops: RouteBinStop[],
    strokeColor: string,
    vehicleId: string,
    targetLayer: L.FeatureGroup,
    isCompleted: boolean = false
  ) => {
    if (!leafletMapRef.current || stops.length === 0) return;

    const depotLat = boundaryData?.depotLat ?? 6.775080;
    const depotLng = boundaryData?.depotLng ?? 79.882289;
    const pathCoordinates: [number, number][] = [
      [depotLat, depotLng],
      ...stops.map((stop) => [stop.lat, stop.lng] as [number, number]),
      [depotLat, depotLng],
    ];

    await drawRoadSnappedPath(pathCoordinates, targetLayer, {
      color: strokeColor,
      tooltip: `Vehicle ${vehicleId}`,
      isCompleted,
    });
  };

  const renderManualRoutePreview = async () => {
    if (!leafletMapRef.current || !draftPreviewLayerRef.current) return;
    draftPreviewLayerRef.current.clearLayers();
    if (selectedBins.length === 0) return;

    const depotLat = boundaryData?.depotLat ?? 6.775080;
    const depotLng = boundaryData?.depotLng ?? 79.882289;
    const stops: [number, number][] = [];
    const bounds = L.latLngBounds([[depotLat, depotLng]]);

    for (const id of selectedBins) {
      const entry = markers.get(id);
      if (entry?.data.lat && entry?.data.lng) {
        stops.push([entry.data.lat, entry.data.lng]);
        bounds.extend([entry.data.lat, entry.data.lng]);
      }
    }
    if (stops.length === 0) return;

    const path: [number, number][] = [[depotLat, depotLng], ...stops, [depotLat, depotLng]];
    await drawRoadSnappedPath(path, draftPreviewLayerRef.current, {
      color: ROUTE_COLORS[0],
      weight: 5,
      opacity: 0.9,
      dashArray: '12, 8',
      className: 'animate-route-flow',
      tooltip: `Manual route · ${stops.length} bins`,
    });

    if (bounds.isValid()) {
      leafletMapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
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
        setRouteStatus('');
        setActiveSessionId('');
        clearRouteVisualization();
        clearDraftRoutePreview();
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

  const eligibleCollectionBins = useMemo(() => {
    let count = 0;
    markers.forEach((entry) => {
      const status = (entry.data.status || '').toLowerCase();
      if (status === 'full' || status === 'half') count += 1;
    });
    return count;
  }, [markers]);

  const fleetCapacitySummary = useMemo(() => {
    const totalMaxBins = vehicles.reduce((sum, v) => sum + getVehicleMaxBins(v), 0);
    const largest = vehicles.reduce((max, v) => Math.max(max, getVehicleMaxBins(v)), 0);
    return { availableVehicles: vehicles.length, totalMaxBins, largestVehicleBins: largest };
  }, [vehicles]);

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
    draftPreviewLayerRef.current = L.featureGroup().addTo(map);

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
      if (draftPreviewLayerRef.current) draftPreviewLayerRef.current.clearLayers();
      if (boundaryLayerRef.current) boundaryLayerRef.current.clearLayers();
    };
  }, [boundaryLoading]);

  // Road-snapped preview for manual bin selection
  useEffect(() => {
    if (!showRoutePlanner || routePlannerTab !== 'manual' || boundaryLoading) return;
    void renderManualRoutePreview();
  }, [showRoutePlanner, routePlannerTab, selectedBins, markers, boundaryData, boundaryLoading]);

  // Draw auto-route drafts on map (one focused route at a time) before confirm
  useEffect(() => {
    if (!showRoutePlanner || routePlannerTab !== 'auto' || !autoRoutePreview || boundaryLoading) return;
    void renderDraftRoutesOnMap(autoRoutePreview, focusedDraftId, confirmedDraftIds);
  }, [
    showRoutePlanner,
    autoRoutePreview,
    routePlannerTab,
    focusedDraftId,
    confirmedDraftIds,
    markers,
    boundaryData,
    boundaryLoading,
  ]);

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
          className: 'bg-[var(--glass-field)] border border-brand-500/30 rounded px-1.5 py-0.5 shadow-sm font-semibold text-[var(--glass-text)]'
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
        status: bin.status || 'not_checked',
        assignedToEmpId: bin.assignedToEmpId ?? undefined,
        assignedToName: bin.assignedToName ?? undefined,
        hasDiscrepancy: Boolean(bin.hasDiscrepancy),
        discrepancyStatus: bin.discrepancyStatus ?? undefined,
      });
    });
  };

  // Builds the HTML tooltip content shown when hovering over a bin marker
  const renderTooltip = (d: BinData) => {
    const statusKey = d.hasDiscrepancy && d.discrepancyStatus ? d.discrepancyStatus : d.status;
    const statusLabel = statusKey === 'full' ? 'Full' : statusKey === 'half' ? 'Half' :
      statusKey === 'empty' ? 'Empty' : 'Not Checked';
    return `<div>
      <strong>Code:</strong> ${d.binCode || d.id}<br/>
      <strong>Fill Status:</strong> ${statusLabel}<br/>
      ${d.hasDiscrepancy ? '<strong style="color:#d97706;">Status discrepancy reported</strong><br/>' : ''}
      <strong>Priority:</strong> ${d.priority}<br/>
      <strong>Zone:</strong> ${d.zone}<br/>
      <strong>Mentor:</strong> ${d.assignedToName || 'Unassigned'}
    </div>`;
  };

  // Creates and registers a Leaflet marker for a bin, wiring up click and context-menu handlers
  const addMarker = (data: BinData) => {
    if (!leafletMapRef.current) return;
    const isSelected = selectedBins.includes(data.id) ? 'route' : (selectedBinsToDelete.includes(data.id) ? 'delete' : false);
    const marker = L.marker([data.lat, data.lng], { icon: getStatusIcon(data.id, data.status, data.fillLevel, isSelected, data.hasDiscrepancy) })
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
        body: JSON.stringify({
          location: newBin.location,
          type: newBin.type,
          fillLevel: 0,
          priority: newBin.priority,
          status: 'empty',
          council: newBin.council,
        })
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
      setNewBin({ location: '', type: 'General Waste', zone: '', council: '', priority: 'medium' });
      const zoneLabel = saved.zone ? ` (Zone ${saved.zone})` : '';
      toast.success(`Bin created successfully${zoneLabel}`);
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
    const entry = markersRef.current.get(id);
    if (!entry) return;
    const newData = { ...entry.data, ...updates };
    entry.data = newData;
    entry.marker.bindTooltip(renderTooltip(newData));
    const isSelected = selectedBins.includes(id) ? 'route' : (selectedBinsToDelete.includes(id) ? 'delete' : false);
    entry.marker.setIcon(getStatusIcon(id, newData.status, newData.fillLevel, isSelected, newData.hasDiscrepancy));
    setMarkers((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) {
        existing.data = newData;
      }
      return next;
    });
  };

  useBinRealtime({
    councilName: council?.name ?? null,
    onUpdate: (msg) => {
      const visual = applyCollectionVisualUpdate(msg);
      const updates: Partial<BinData> = {};
      const normalized = normalizeBinStatus(visual.status);
      const statusMap: Record<string, BinData['status']> = {
        full: 'full',
        half: 'half',
        empty: 'empty',
        notChecked: 'not_checked',
      };
      if (statusMap[normalized]) {
        updates.status = statusMap[normalized];
      }
      if (visual.fillLevel != null) updates.fillLevel = visual.fillLevel;
      const collected =
        msg.type === 'BIN_COLLECTED' && msg.collectionStatus?.toUpperCase() === 'COLLECTED';
      const reportedDiscrepancy =
        msg.type === 'BIN_STATUS_UPDATED' && msg.discrepancy === true;
      if (collected) {
        updates.hasDiscrepancy = false;
        updates.discrepancyStatus = undefined;
      } else if (reportedDiscrepancy) {
        updates.hasDiscrepancy = true;
        if (statusMap[normalized]) {
          updates.discrepancyStatus = statusMap[normalized];
          updates.status = statusMap[normalized];
        }
      }
      if (Object.keys(updates).length > 0) {
        updateBinLocally(String(msg.binId), updates);
      }
      if (msg.type === 'BIN_COLLECTED' && msg.collectionStatus) {
        toast.info(`Bin ${msg.binId}: ${msg.collectionStatus}`);
      }
    },
  });

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

  const assignMentorToBin = async (id: string, mentorEmpId: string) => {
    try {
      if (!canManageBin(id)) {
        toast.error('You can only manage bins from your assigned council.');
        return;
      }
      const res = await fetch(`${BINS_API}/${id}/assign-mentor`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ mentorEmpId: mentorEmpId ? Number(mentorEmpId) : null }),
      });
      const payload = await res.json().catch(() => ({} as { success?: boolean; message?: string; data?: { assignedToEmpId?: number; assignedToName?: string } }));
      if (!res.ok || payload.success === false) {
        throw new Error(payload.message || 'Mentor assignment failed');
      }
      const mentorFromList = mentors.find((m) => String(m.empId) === mentorEmpId);
      updateBinLocally(id, {
        assignedToEmpId: mentorEmpId ? Number(mentorEmpId) : undefined,
        assignedToName: mentorEmpId
          ? (payload.data?.assignedToName ?? mentorFromList?.empName ?? `Mentor #${mentorEmpId}`)
          : undefined,
      });
      toast.success(mentorEmpId ? 'Mentor assigned' : 'Mentor unassigned');
      setContextMenu(null);
    } catch (e) {
      console.error('Failed to assign mentor', e);
      toast.error(e instanceof Error ? e.message : 'Failed to assign mentor');
    }
  };

  const adminCollectBin = async (id: string) => {
    try {
      if (!canManageBin(id)) {
        toast.error('You can only manage bins from your assigned council.');
        return;
      }
      const res = await fetch(`${BINS_API}/${id}/admin-collect`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Admin collect failed');
      updateBinLocally(id, { status: 'empty', fillLevel: 0 });
      toast.success('Bin marked as collected');
      setContextMenu(null);
    } catch (e) {
      console.error('Failed to mark bin collected', e);
      toast.error('Failed to mark bin as collected');
    }
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
      <div className="flex h-full min-h-[calc(100dvh-3.75rem)] w-full items-center justify-center bg-background md:min-h-0">
        <GarboLoader variant="inline" message="Loading map..." size="lg" />
      </div>
    );
  }

  return (
    <div className="garbo-map-root relative h-full min-h-[calc(100dvh-3.75rem)] w-full overflow-hidden bg-background md:min-h-0">
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
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] flex items-center bg-[var(--glass-surface-solid)] backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl shadow-xl px-2 py-1.5 gap-1 transition-all w-max max-w-[calc(100vw-2rem)]">
        {/* Council — superadmin selects here; council-admin sees read-only badge */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-brand-muted text-brand-700 dark:text-brand-muted-foreground border border-brand-200/40 rounded-xl text-[11px] font-semibold shrink-0">
          <Layers className="w-3.5 h-3.5 text-brand-600 shrink-0" />
          {isSuperadmin ? (
            <select
              value={selectedCouncilId === 'all' ? '' : selectedCouncilId}
              onChange={(e) => setSelectedCouncilId(e.target.value || 'all')}
              className="bg-transparent border-0 outline-none text-brand-800 dark:text-brand-muted-foreground font-semibold text-[11px] max-w-[140px] truncate cursor-pointer"
              title="Select council"
            >
              <option value="">Select council…</option>
              {councils.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate max-w-[160px]">{council?.name || 'Council'}</span>
          )}
        </div>

        <div className="w-px h-5 bg-border/50 shrink-0" />

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
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
        >
          <Plus className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${addMode ? 'rotate-45' : ''}`} />
          <span className="hidden sm:inline">{addMode ? 'Place Bin' : 'Add Bin'}</span>
        </button>

        <div className="w-px h-4 bg-border/50 shrink-0" />

        {/* Routes — manual + auto in one right-side panel (tabs) */}
        <button
          title={showRoutePlanner ? 'Close route planner' : 'Plan collection routes'}
          onClick={() => {
            if (showRoutePlanner) {
              closeRoutePlanner();
            } else {
              clearRouteVisualization();
              setRouteStatus('');
              setRouteError('');
              openRoutePlanner('manual');
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${showRoutePlanner
            ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
        >
          <Navigation className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{showRoutePlanner ? 'Routes…' : 'Routes'}</span>
        </button>

        <div className="w-px h-4 bg-border/50 shrink-0" />

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
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">{deleteSelectionMode ? 'Selecting...' : 'Delete Bins'}</span>
        </button>

        <div className="w-px h-4 bg-border/50 shrink-0" />

        {/* Route History (includes route visibility controls) */}
        <button
          title="Route History"
          onClick={() => {
            const nextShow = !showHistorySheet;
            if (nextShow) {
              closeMapSidePanels('history');
              setAddMode(false);
              setShowHistorySheet(true);
              loadRouteHistory();
            } else {
              setShowHistorySheet(false);
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${showHistorySheet
            ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">History</span>
        </button>

        {/* Focus Mode — only when a single council is active */}
        {council?.name && (
          <>
            <div className="w-px h-4 bg-border/50 shrink-0" />
            <button
              title={focusMode ? 'Disable focus mask' : 'Enable focus mask'}
              onClick={() => setFocusMode(!focusMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${focusMode
                ? 'bg-green-600 text-white shadow-sm hover:bg-green-700'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
            >
              {focusMode ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
              <span className="hidden sm:inline">{focusMode ? 'Focus' : 'Unfocused'}</span>
            </button>
          </>
        )}

        <div className="w-px h-4 bg-border/50 shrink-0" />

        {/* Legend */}
        <button
          title="Map Legend"
          onClick={() => {
            const next = !showLegend;
            if (next) {
              closeMapSidePanels('legend');
              setShowLegend(true);
            } else {
              setShowLegend(false);
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-medium text-[11px] transition-all active:scale-95 shrink-0 ${showLegend
            ? 'bg-slate-800 text-white shadow-sm hover:bg-slate-900'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
        >
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Legend</span>
        </button>
      </div>

      {/* MAP LEGEND SIDE PANEL */}
      <MapSidePanel
        open={showLegend}
        onClose={() => setShowLegend(false)}
        title="Map Legend"
        icon={<Info className="w-5 h-5 text-[var(--glass-text-muted)] shrink-0" />}
      >
        <div className="p-5 flex flex-col gap-3 text-xs text-[var(--glass-text)]">
            {/* Bin markers — matches field-staff report statuses */}
            <span className="text-[10px] font-bold text-[var(--glass-text-muted)] uppercase tracking-wider">
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

            <hr className="border-[var(--glass-border)]" />

            {/* Selection badges */}
            <span className="text-[10px] font-bold text-[var(--glass-text-muted)] uppercase tracking-wider">
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

            <hr className="border-[var(--glass-border)]" />

            {/* Routes — aligned with History visibility (W4) */}
            <span className="text-[10px] font-bold text-[var(--glass-text-muted)] uppercase tracking-wider">
              Collection routes
            </span>
            <p className="text-[10px] text-[var(--glass-text-muted)] leading-snug">
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

            <hr className="border-[var(--glass-border)]" />

            {/* Map overlays */}
            <span className="text-[10px] font-bold text-[var(--glass-text-muted)] uppercase tracking-wider">
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
      </MapSidePanel>

      {/* CREATE BIN DIALOG */}
      <AddBinGlassModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        zIndex={10000}
        nextBinCode={nextBinCode}
        location={newBin.location}
        onLocationChange={(value) => setNewBin((p) => ({ ...p, location: value }))}
        type={newBin.type}
        onTypeChange={(value) => setNewBin((p) => ({ ...p, type: value }))}
        priority={newBin.priority}
        onPriorityChange={(value) => setNewBin((p) => ({ ...p, priority: value }))}
        showTypeSelect
        onSubmit={handleCreateBinSubmit}
      />

      {/* ROUTE PLANNER SIDE PANEL (manual + auto) */}
      <MapSidePanel
        open={showRoutePlanner}
        onClose={closeRoutePlanner}
        title="Route Planner"
        icon={<Navigation className="w-5 h-5 text-green-600 shrink-0" />}
        headerExtra={
          routePlannerTab === 'manual' ? (
            <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0">
              {selectedBins.length} bins
            </span>
          ) : autoRoutePreview ? (
            <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0">
              {remainingDraftRoutes.length} routes
            </span>
          ) : null
        }
        footer={routeSessionFooter ?? undefined}
        bodyClassName="flex flex-col overflow-hidden"
      >
        {/* Manual / Auto tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-[var(--glass-border)] flex gap-2 shrink-0">
          {(['manual', 'auto'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => switchRoutePlannerTab(tab)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${routePlannerTab === tab
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-[var(--glass-surface)] text-[var(--glass-text-muted)] border border-[var(--glass-border)] hover:bg-[var(--glass-surface-solid)]'
                }`}
            >
              {tab === 'manual' ? 'Manual Route' : 'Auto Route'}
            </button>
          ))}
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          {routePlannerTab === 'auto' ? (
            <>
              {autoRouteLoading ? (
                <div className="flex flex-col items-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                  <p className="text-xs text-[var(--glass-text-muted)]">Analysing bins and fleet capacity...</p>
                </div>
              ) : !autoRoutePreview ? (
                <>
                  <div className="text-[11px] text-[var(--glass-text-muted)] bg-[var(--glass-surface)] rounded-xl p-3 border border-[var(--glass-border)] space-y-2">
                    <p className="font-semibold text-[var(--glass-text)]">Auto Route</p>
                    <p>
                      <strong>{eligibleCollectionBins}</strong> bins need collection (full / half)
                    </p>
                    <p>
                      Fleet: <strong>{fleetCapacitySummary.availableVehicles}</strong> vehicles ·{' '}
                      <strong>{fleetCapacitySummary.totalMaxBins}</strong> total bin capacity
                    </p>
                    <p className="text-[var(--glass-text-muted)]">
                      Click generate — bins are auto-selected by fill level and map clustering. You assign vehicle & driver per route, then confirm one by one.
                    </p>
                  </div>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold h-11"
                    disabled={autoRouteLoading || eligibleCollectionBins === 0 || fleetCapacitySummary.availableVehicles === 0}
                    onClick={() => void loadAutoRoutePreview()}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Generate Routes
                  </Button>
                  {eligibleCollectionBins === 0 && (
                    <p className="text-[10px] text-amber-700 text-center">No full or half bins in this council yet.</p>
                  )}
                </>
              ) : autoRoutePreview ? (
                <>
                  {remainingDraftRoutes.length > 0 && focusedDraftIndex >= 0 && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-green-600/10 border border-green-200/60 px-3 py-2">
                      <p className="text-[11px] font-semibold text-green-800">
                        Map preview: Route {focusedDraftIndex + 1} of {remainingDraftRoutes.length}
                      </p>
                      <span className="text-[10px] text-green-700 shrink-0">Tap a card to switch</span>
                    </div>
                  )}
                  <div className="text-[11px] text-[var(--glass-text-muted)] bg-[var(--glass-surface)] rounded-xl p-3 border border-[var(--glass-border)] space-y-2">
                    <p className="font-semibold text-[var(--glass-text)]">Generated routes — confirm one at a time</p>
                    <p>
                      <strong>{autoRoutePreview.totalBinsNeedingCollection}</strong> bins need collection →{' '}
                      <strong>{autoRoutePreview.draftRoutes.length}</strong> route(s) created
                    </p>
                    <p>
                      Fleet: <strong>{autoRoutePreview.fleetSummary.availableVehicles}</strong> vehicles ·{' '}
                      <strong>{autoRoutePreview.fleetSummary.totalMaxBins}</strong> total bin capacity
                    </p>
                    <p className="text-[var(--glass-text-muted)]">Bins auto-selected by fill level + map clustering. Assign vehicle & driver per route.</p>
                  </div>
                  {autoRoutePreview.warnings.map((w) => (
                    <p key={w} className="text-[11px] text-amber-700 bg-amber-50/80 rounded-lg px-3 py-2 border border-amber-100">
                      {w}
                    </p>
                  ))}
                  <div className="space-y-3">
                    {remainingDraftRoutes.map((draft, idx) => {
                        const routeColor = ROUTE_COLORS[idx % ROUTE_COLORS.length];
                        const isFocused = focusedDraftId === draft.draftId;
                        return (
                      <div
                        key={draft.draftId}
                        className={`rounded-xl border p-3 space-y-2 shadow-sm transition-all cursor-pointer ${isFocused
                          ? 'border-green-300/80 bg-green-50/40 ring-1 ring-green-200/60'
                          : 'border-[var(--glass-border)] bg-[var(--glass-surface)] hover:bg-[var(--glass-surface-solid)]'
                          }`}
                        onClick={() => setFocusedDraftId(draft.draftId)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm"
                              style={{ backgroundColor: routeColor }}
                            />
                            <span className="text-xs font-bold text-[var(--glass-text)] truncate">
                              Route {idx + 1}
                              {draft.suggestedZone ? ` · Zone ${draft.suggestedZone}` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                            {draft.binCount} bins
                          </span>
                        </div>
                        {isFocused && (
                          <p className="text-[10px] text-green-700">Shown on map — road route + highlighted bins</p>
                        )}
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                              Vehicle
                            </label>
                            <select
                              value={draftAssignments[draft.draftId]?.vehicleId ?? ''}
                              onChange={(e) =>
                                setDraftAssignments((prev) => ({
                                  ...prev,
                                  [draft.draftId]: {
                                    vehicleId: e.target.value,
                                    driverId: prev[draft.draftId]?.driverId ?? '',
                                  },
                                }))
                              }
                              className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                            >
                              {renderVehicleOptions(draft.binCount, draftAssignments[draft.draftId]?.vehicleId ?? '')}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                              Driver
                            </label>
                            <select
                              value={draftAssignments[draft.draftId]?.driverId ?? ''}
                              onChange={(e) =>
                                setDraftAssignments((prev) => ({
                                  ...prev,
                                  [draft.draftId]: {
                                    vehicleId: prev[draft.draftId]?.vehicleId ?? '',
                                    driverId: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                            >
                              <option value="">-- Driver --</option>
                              {drivers.map((d) => (
                                <option key={d.empId} value={d.empId}>
                                  {d.empName || 'Unnamed'}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <Button
                          disabled={confirmingDraftId === draft.draftId}
                          className="w-full bg-green-600 hover:bg-green-700 text-white text-xs font-semibold h-9 disabled:opacity-50 flex items-center justify-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleConfirmSingleDraft(draft, `Route ${idx + 1}`);
                          }}
                        >
                          {confirmingDraftId === draft.draftId ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Navigation className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          {confirmingDraftId === draft.draftId ? 'Optimizing...' : 'Confirm This Route'}
                        </Button>
                      </div>
                    );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-xs h-10"
                    onClick={() => void loadAutoRoutePreview()}
                    disabled={autoRouteLoading}
                  >
                    Regenerate Routes
                  </Button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold text-[var(--glass-text-muted)] uppercase tracking-wider">Selected Bins</span>
              {selectedBins.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-[var(--glass-border)] rounded-xl p-6 bg-muted/40">
                  <MapPin className="w-6 h-6 text-muted-foreground/50 mb-1" />
                  <p className="text-muted-foreground text-xs text-center">Click bins on the map to add them to this route</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto p-2 border border-[var(--glass-border)] rounded-xl bg-[var(--glass-surface)]">
                  {selectedBins.map((id) => {
                    const entry = markers.get(id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-1.5 bg-[var(--glass-field)] text-[var(--glass-text)] px-3 py-1 rounded-full text-xs font-medium border border-[var(--glass-border)] shadow-sm shrink-0"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: STATUS_COLOR_MAP[entry?.data.status || 'not_checked'] }}
                        />
                        <span>{entry?.data.binCode || id}</span>
                        <button
                          type="button"
                          onClick={() => toggleBinSelection(id)}
                          className="text-muted-foreground hover:text-red-500 font-bold ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                    Vehicle
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                  >
                    {renderVehicleOptions(selectedBins.length, selectedVehicleId)}
                  </select>
                  {selectedBins.length > 0 && vehicles.every((v) => !isVehicleCapacitySufficient(v, selectedBins.length)) && (
                    <p className="text-[10px] text-red-600 mt-1">No vehicle has enough capacity for {selectedBins.length} bins</p>
                  )}
                </div>
                <div>
                  <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                    Driver
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                  >
                    <option value="">-- Driver --</option>
                    {drivers.map((d) => (
                      <option key={d.empId} value={d.empId}>
                        {d.empName || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 text-xs h-10"
                  onClick={() => {
                    clearSelectedBinIcons(selectedBins);
                    setSelectedBins([]);
                  }}
                >
                  Clear All
                </Button>
                <Button
                  disabled={isGeneratingRoute}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold h-10 disabled:opacity-50 flex items-center justify-center"
                  onClick={handleGenerateManualRoute}
                >
                  {isGeneratingRoute ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Navigation className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {isGeneratingRoute ? 'Generating...' : 'Generate Route'}
                </Button>
              </div>
            </>
          )}
        </div>
      </MapSidePanel>

      {/* COLLAPSIBLE BULK BIN DELETION BOTTOM DRAWER */}
      {deleteSelectionMode && (
        <div
          style={{ zIndex: 999 }}
          className={`absolute bottom-0 left-0 right-0 bg-[var(--glass-surface-solid)] backdrop-blur-md border-t border-border shadow-[var(--shadow-elevated)] transition-all duration-300 ease-in-out flex flex-col ${isPlannerExpanded ? 'h-[280px]' : 'h-14'
            }`}
        >
          {/* Header/Collapsed Panel Bar */}
          <div
            className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0 cursor-pointer select-none bg-red-50/50 hover:bg-red-50/80 transition-colors"
            onClick={() => setIsPlannerExpanded(!isPlannerExpanded)}
          >
            <div className="flex items-center gap-3">
              {isPlannerExpanded ? (
                <ChevronDown className="w-5 h-5 text-red-500 animate-bounce" />
              ) : (
                <ChevronUp className="w-5 h-5 text-red-500 animate-bounce" />
              )}
              <span className="font-semibold text-foreground text-sm">Bulk Bin Deletion</span>
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
            <div className="p-5 flex flex-col md:flex-row gap-6 overflow-hidden flex-1 bg-card">
              {/* Left Column: Selected Bins Tag Chips */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Bins to Delete</span>
                {selectedBinsToDelete.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-4 bg-muted/50">
                    <Trash2 className="w-6 h-6 text-muted-foreground/50 mb-1" />
                    <p className="text-muted-foreground text-xs text-center">Click bins on the map to add them to the deletion list</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[140px] p-2 border border-border rounded-xl bg-slate-50/50">
                    {selectedBinsToDelete.map(id => {
                      const entry = markers.get(id);
                      return (
                        <div key={id} className="flex items-center gap-1.5 bg-[var(--glass-field)] text-foreground px-3 py-1 rounded-full text-xs font-medium border border-border shadow-sm shrink-0">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR_MAP[entry?.data.status || 'not_checked'] }}></span>
                          <span>{entry?.data.binCode || id}</span>
                          <button
                            type="button"
                            onClick={() => toggleDeleteBinSelection(id)}
                            className="text-muted-foreground hover:text-red-500 font-bold ml-1 transition-colors"
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
                    className="flex-1 text-xs h-10 border-border"
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

      {/* ROUTE HISTORY SIDE PANEL */}
      <MapSidePanel
        open={showHistorySheet}
        onClose={() => setShowHistorySheet(false)}
        title="Route History & Active Sessions"
        icon={<Clock className="w-5 h-5 text-green-600 shrink-0" />}
        bodyClassName="flex flex-col overflow-hidden"
      >
        {/* History filter tabs */}
        <div className="px-5 py-3 border-b border-[var(--glass-border)] bg-slate-50/20 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            {(['all', 'active', 'completed'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setHistoryTab(tab)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${historyTab === tab
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-[var(--glass-surface)] text-[var(--glass-text-muted)] border border-[var(--glass-border)] hover:bg-[var(--glass-surface-solid)]'
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
        <div className="px-5 py-3 border-b border-[var(--glass-border)] flex items-center justify-between text-xs font-medium text-[var(--glass-text)] bg-green-50/10 shrink-0">
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-green-600" />
            Hover Cards to Preview on Map
          </span>
          <Switch checked={hoverPreview} onCheckedChange={setHoverPreview} />
        </div>

        {/* Map visibility — active routes only (W4, integrated into History) */}
        {loadedRouteSessions.length > 0 && (
          <div className="px-5 py-2.5 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0 bg-muted/40">
            <span className="text-[11px] font-semibold text-[var(--glass-text-muted)] flex items-center gap-1.5">
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
                className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-[var(--glass-text)] hover:bg-slate-200 border border-slate-200"
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
              <p className="text-muted-foreground text-xs font-medium">Loading history...</p>
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-center text-muted-foreground">
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
                  className="border border-[var(--glass-border)] rounded-xl p-4 shadow-sm hover:shadow-md hover:border-[var(--glass-border)] transition-all bg-[var(--glass-surface)] hover:bg-[var(--glass-surface-solid)] relative overflow-hidden group"
                >
                  {/* Route color strip — matches map polyline when active */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1.5"
                    style={{ backgroundColor: isActive ? routeColor : '#94a3b8' }}
                  />

                  <div className="flex justify-between items-start mb-2.5">
                    <span className="font-semibold text-[var(--glass-text)] text-sm">Session #{r.id || i + 1}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${isActive
                      ? 'bg-emerald-50/70 text-emerald-700 border-emerald-100/50'
                      : 'bg-slate-50/70 text-[var(--glass-text)] border-slate-200/50'
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
                    <span className="text-[11px] font-medium text-[var(--glass-text-muted)]">
                      Visible on map
                    </span>
                  </label>

                  <div className="text-[11px] text-[var(--glass-text-muted)] space-y-1.5 mb-3">
                    <div className="flex justify-between">
                      <span>Vehicle Code:</span>
                      <span className="font-medium text-[var(--glass-text)]">{r.vehicleCode || 'N/A'}</span>
                    </div>
                    {r.driverName && (
                      <div className="flex justify-between">
                        <span>Driver Name:</span>
                        <span className="font-medium text-[var(--glass-text)]">{r.driverName}</span>
                      </div>
                    )}
                    {r.createdDate && (
                      <div className="flex justify-between">
                        <span>Date Created:</span>
                        <span className="font-medium text-[var(--glass-text)]">{new Date(r.createdDate).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>
      </MapSidePanel>

      {/* CONTEXT MENU — appears on right-click of a bin marker */}
      {contextMenu && contextMenuPos && (
        <div style={{ top: contextMenuPos.y, left: contextMenuPos.x, zIndex: 9999, transform: 'translate(-50%, -105%)' }}
          className="absolute bg-card shadow-xl rounded-lg p-2.5 z-[2000] min-w-[190px] border border-border flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 uppercase tracking-wider flex justify-between items-center border-b border-border pb-1.5">
            <span>Manage Bin</span>
            <button onClick={() => setContextMenu(null)} className="text-muted-foreground hover:text-muted-foreground">✕</button>
          </div>
          {markers.get(contextMenu.binId)?.data.hasDiscrepancy && (
            <div className="mx-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] font-semibold text-amber-800">
              Status discrepancy reported
            </div>
          )}
          <div className="px-2 py-0.5">
            <label className="text-[10px] text-muted-foreground font-bold block mb-1 uppercase tracking-wider">Priority</label>
            <select className="w-full text-xs border border-border rounded p-1.5 bg-muted focus:ring focus:ring-green-200 outline-none"
              value={markers.get(contextMenu.binId)?.data.priority || 'medium'}
              onChange={(e) => updatePriority(contextMenu.binId, e.target.value as BinData['priority'])}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="px-2 py-0.5">
            <label className="text-[10px] text-muted-foreground font-bold block mb-1 uppercase tracking-wider">Assign mentor</label>
            {markers.get(contextMenu.binId)?.data.assignedToName ? (
              <p className="mb-1 text-xs font-medium text-green-700">
                {markers.get(contextMenu.binId)?.data.assignedToName}
              </p>
            ) : (
              <p className="mb-1 text-xs text-muted-foreground">Unassigned</p>
            )}
            <select
              className="w-full text-xs border border-border rounded p-1.5 bg-muted focus:ring focus:ring-green-200 outline-none"
              value={markers.get(contextMenu.binId)?.data.assignedToEmpId ? String(markers.get(contextMenu.binId)?.data.assignedToEmpId) : ''}
              onChange={(e) => assignMentorToBin(contextMenu.binId, e.target.value)}
            >
              <option value="">Unassign</option>
              {mentors.map((m) => (
                <option key={m.empId} value={String(m.empId)}>
                  {m.empName || `Mentor #${m.empId}`}
                </option>
              ))}
            </select>
          </div>
          <div className="px-2 py-0.5">
            <label className="text-[10px] text-muted-foreground font-bold block mb-1 uppercase tracking-wider">Zone</label>
            <select
              className="w-full text-xs border border-border rounded p-1.5 bg-muted focus:ring focus:ring-green-200 outline-none"
              value={markers.get(contextMenu.binId)?.data.zone || 'unassigned'}
              onChange={(e) => updateZone(contextMenu.binId, e.target.value)}
            >
              {ZONE_OPTIONS.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => adminCollectBin(contextMenu.binId)}
            disabled={!canManageBin(contextMenu.binId)}
            className="text-left px-2 py-2 text-xs text-green-700 hover:bg-green-50 rounded-md transition-colors font-bold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark as collected
          </button>
          <hr className="my-1 border-border" />
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
