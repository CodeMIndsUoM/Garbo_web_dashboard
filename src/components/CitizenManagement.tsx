'use client';

// Admin page for reviewing citizen complaints and event suggestions.
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "./ui/dialog";
import { 
  Search, 
  MapPin, 
  Clock, 
  Info, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  Calendar,
  Layers
} from 'lucide-react';

import { toast } from 'sonner';
import { ViewModeToggle } from './ViewModeToggle';
import { useAdminViewMode } from '../lib/useAdminViewMode';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

// Shape of a complaint record from the backend API
interface ComplaintItem {
  id: number;
  title?: string;
  description?: string;
  status?: string;
  issueType?: string;
  urgency?: string;
  wasteType?: string;
  latitude?: number;
  longitude?: number;
  otherIssueDetail?: string;
  location?: string;
  createdAt?: string;
  imageUrl?: string;
}

// Shape of an event or event suggestion from the backend API
interface EventItem {
  id: number;
  title?: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  eventDate?: string;
  status?: string;
  imageUrl?: string;
  rejectionReason?: string;
}

// Row, card bar, and badge colors for complaint status.
function getComplaintStatusStyles(status?: string) {
  const s = (status || 'PENDING').toUpperCase();
  // row = table row tint, bar = card top accent, badge = inline status pill
  if (s === 'ACCEPTED' || s === 'COMPLETED') {
    return { row: 'bg-green-50 hover:bg-green-100/70', badge: 'bg-green-100 text-green-700', label: s === 'COMPLETED' ? 'Completed' : 'Accepted', bar: 'bg-green-500' };
  }
  if (s === 'REJECTED') {
    return { row: 'bg-red-50 hover:bg-red-100/70', badge: 'bg-red-100 text-red-700', label: 'Rejected', bar: 'bg-red-500' };
  }
  return { row: 'bg-amber-50 hover:bg-amber-100/70', badge: 'bg-amber-100 text-amber-700', label: status || 'Pending', bar: 'bg-amber-500' };
}

// Urgency pill colors on complaint rows and cards.
function getUrgencyBadgeClass(urgency?: string) {
  switch (urgency) {
    case 'High': return 'bg-red-100 text-red-700';
    case 'Medium': return 'bg-orange-100 text-orange-700';
    default: return 'bg-emerald-100 text-emerald-700';
  }
}

export function CitizenManagement({ council }: { council?: { name?: string } | null }) {
  // --- Complaints, event suggestions, and approved events ---
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [activeEvents, setActiveEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Complaint detail and event reject modals ---
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintItem | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // --- Search, table/card toggle, and stat-card filter ---
  const [searchQuery, setSearchQuery] = useState("");
  const { viewMode, setViewMode } = useAdminViewMode();
  // Set when admin clicks a summary stat card to filter complaints or events.
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'events'>('all');

  // Auth token for protected API calls
  const tokenHeader = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    loadData();
  }, []);

  // Accepts or rejects a complaint from the detail modal.
  const updateComplaint = async (id: number, status: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tokenHeader() },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        toast.success(`Complaint #${id} marked as ${status}`);
        loadData();
      } else {
        const errData = await response.json().catch(() => ({}));
        toast.error(errData.message || `Failed to update complaint #${id}`);
      }
    } catch (error) {
      console.error("Error updating complaint:", error);
      toast.error("Connection error. Could not update complaint.");
    }
  };

  // Complaints matching the search box (by type, description, or ID).
  const filteredComplaints = complaints.filter(c => 
    (c.issueType?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (c.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    c.id.toString().includes(searchQuery)
  );

  // Complaints shown after search and stat-card filter are applied.
  const displayedComplaints = useMemo(() => {
    if (activeFilter === 'events') return [];
    let list = filteredComplaints;
    if (activeFilter === 'pending') {
      list = list.filter(c => {
        const s = (c.status || 'PENDING').toUpperCase();
        return s === 'PENDING' || s === 'NEW';
      });
    } else if (activeFilter === 'accepted') {
      list = list.filter(c => {
        const s = (c.status || '').toUpperCase();
        return s === 'ACCEPTED' || s === 'COMPLETED';
      });
    } else if (activeFilter === 'rejected') {
      list = list.filter(c => (c.status || '').toUpperCase() === 'REJECTED');
    }
    return list;
  }, [filteredComplaints, activeFilter]);

  // Controls which page sections are visible for the current stat-card filter.
  const showComplaintsSection = activeFilter !== 'events';
  const showEventSuggestions = activeFilter === 'all' || activeFilter === 'events';
  const showActiveEvents = activeFilter === 'all';

  // Clicking the same stat card again clears the filter.
  const toggleActiveFilter = (filter: typeof activeFilter) => {
    setActiveFilter((current) => (current === filter ? 'all' : filter));
  };

  // Highlights the active stat card when a filter is applied.
  const statCardClass = (filter: typeof activeFilter) =>
    `bg-white border-none shadow-sm cursor-pointer transition-all hover:shadow-md ${activeFilter === filter ? 'ring-2 ring-offset-2 ring-gray-900 shadow-md' : ''}`;

  // Human-readable label shown in the active filter banner.
  const filterLabel = (filter: typeof activeFilter) => {
    switch (filter) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'rejected': return 'Rejected';
      case 'events': return 'Pending Events';
      default: return 'All';
    }
  };

  // Counts shown on the summary stat cards at the top.
  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => {
      const s = (c.status || "PENDING").toUpperCase();
      return s === "PENDING" || s === "NEW";
    }).length,
    approved: complaints.filter(c => {
      const s = (c.status || "").toUpperCase();
      return s === "ACCEPTED" || s === "COMPLETED";
    }).length,
    rejected: complaints.filter(c => (c.status || "").toUpperCase() === "REJECTED").length,
    eventSuggestions: events.length
  };

  // Fetches complaints, pending event suggestions, and active events from the API.
  const loadData = async () => {
    setLoading(true);
    try {
      console.log("Fetching citizen management data...");
      // Loads complaints, pending event suggestions, and active events in parallel.
      const [complaintsRes, eventsRes, activeEventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/complaints`, { headers: tokenHeader() }),
        fetch(`${API_BASE}/api/events/suggestions`, { headers: tokenHeader() }),
        fetch(`${API_BASE}/api/events`, { headers: tokenHeader() }),
      ]);
      
      if (!complaintsRes.ok) console.error("Complaints API error:", complaintsRes.status);
      if (!eventsRes.ok) {
        const errData = await eventsRes.json().catch(() => ({}));
        console.error("Events suggestions API error:", eventsRes.status, errData.message || "");
      }
      if (!activeEventsRes.ok) console.error("Active events API error:", activeEventsRes.status);

      const complaintsJson = await complaintsRes.json().catch(() => []);
      const eventsJson = await eventsRes.json().catch(() => []);
      const activeEventsJson = await activeEventsRes.json().catch(() => []);
      
      console.log("Loaded complaints:", complaintsJson.length);
      console.log("Loaded event suggestions:", eventsJson.length);
      console.log("Loaded active events:", activeEventsJson.length);

      setComplaints(Array.isArray(complaintsJson) ? complaintsJson : []);
      setEvents(Array.isArray(eventsJson) ? eventsJson : []);
      setActiveEvents(Array.isArray(activeEventsJson) ? activeEventsJson : []);
    } catch (err) {
      console.error("Failed to load citizen data:", err);
      toast.error("Failed to sync data with server");
    } finally {
      setLoading(false);
    }
  };

  // Approves or rejects a citizen event suggestion.
  const updateEvent = async (id: number, action: 'approve' | 'reject', reason?: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/events/${id}/${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tokenHeader() },
        body: action === 'reject' ? JSON.stringify({ reason }) : undefined,
      });
      if (response.ok) {
        toast.success(`Event suggestion ${action === 'approve' ? 'approved' : 'rejected'}`);
        loadData();
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(err.message || "Failed to update event suggestion");
      }
    } catch (error) {
      toast.error("Connection error");
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Page title and council badge */}
      <div>
        <h2 className="text-gray-900 mb-2 font-bold text-2xl">Citizen Management</h2>
        <p className="text-gray-600">Review citizen complaints and event submissions</p>
        {council?.name && (
          <Badge variant="outline" className="mt-2 bg-emerald-50 text-emerald-700 border-emerald-100">
            Council: {council.name}
          </Badge>
        )}
      </div>

      {/* Stats Summary — click to filter sections below */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className={statCardClass('all')} onClick={() => toggleActiveFilter('all')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 uppercase tracking-wider">Total Reports</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-xl">
                <Info className="w-5 h-5 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={statCardClass('pending')} onClick={() => toggleActiveFilter('pending')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-500 font-medium mb-1 uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
              </div>
              <div className="p-2.5 bg-orange-50 rounded-xl">
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={statCardClass('accepted')} onClick={() => toggleActiveFilter('accepted')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-500 font-medium mb-1 uppercase tracking-wider">Accepted</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={statCardClass('rejected')} onClick={() => toggleActiveFilter('rejected')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-500 font-medium mb-1 uppercase tracking-wider">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <div className="p-2.5 bg-red-50 rounded-xl">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={statCardClass('events')} onClick={() => toggleActiveFilter('events')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-500 font-medium mb-1 uppercase tracking-wider">Pending Events</p>
                <p className="text-2xl font-bold text-blue-600">{stats.eventSuggestions}</p>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-xl">
                <Calendar className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active stat-card filter banner */}
      {activeFilter !== 'all' && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>
            Showing <strong>{filterLabel(activeFilter)}</strong> only
          </span>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className="text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Search & view mode */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search by issue type, description or ID..." 
            className="pl-10 h-11 bg-white border-none shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {showComplaintsSection && (
      <div className="space-y-4">
        {/* Citizen complaints section header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            Citizen Complaints
            <Badge variant="secondary" className="rounded-full bg-gray-100 text-gray-600 font-semibold border-none">
              {displayedComplaints.length}
            </Badge>
          </h3>
        </div>

        {/* Complaints list — card grid or table; switches with ViewModeToggle */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-4" />
            <p className="text-gray-500">Fetching latest reports...</p>
          </div>
        ) : displayedComplaints.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">
              {activeFilter !== 'all' ? `No ${filterLabel(activeFilter).toLowerCase()} complaints found` : 'No complaints found'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {activeFilter !== 'all' ? (
                <button type="button" onClick={() => setActiveFilter('all')} className="text-emerald-600 hover:underline">
                  Clear filter
                </button>
              ) : (
                'Check back later for new citizen submissions.'
              )}
            </p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Card grid view */}
            {displayedComplaints.map((complaint) => {
              const statusStyles = getComplaintStatusStyles(complaint.status);
              return (
                <Card
                  key={complaint.id}
                  className="bg-white border-none shadow-sm overflow-hidden cursor-pointer"
                  onClick={() => setSelectedComplaint(complaint)}
                >
                  <div className={`h-1.5 ${statusStyles.bar}`} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 font-medium">#{complaint.id}</p>
                        <p className="text-base font-semibold text-gray-900 mt-0.5">
                          {complaint.issueType || 'General'}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusStyles.badge}`}>
                        {statusStyles.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3 mb-3">
                      {complaint.description || 'No description provided'}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      {complaint.urgency ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getUrgencyBadgeClass(complaint.urgency)}`}>
                          {complaint.urgency}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      <span className="text-gray-500">
                        {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-emerald-600 font-bold hover:text-emerald-700 hover:bg-gray-100 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedComplaint(complaint);
                        }}
                      >
                        {complaint.status === 'ACCEPTED' ? 'View' : 'Review'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-white border-none shadow-sm overflow-hidden">
            {/* Table view */}
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white">
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">ID</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Issue Type</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Urgency</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Description</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Date</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Status</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedComplaints.map((complaint) => {
                      const statusStyles = getComplaintStatusStyles(complaint.status);
                      return (
                        <tr
                          key={complaint.id}
                          className={`border-b border-white/60 transition-colors cursor-pointer ${statusStyles.row}`}
                          onClick={() => setSelectedComplaint(complaint)}
                        >
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">#{complaint.id}</td>
                          <td className="px-6 py-4 text-sm text-gray-800">
                            {complaint.issueType || 'General'}
                          </td>
                          <td className="px-6 py-4">
                            {complaint.urgency ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getUrgencyBadgeClass(complaint.urgency)}`}>
                                {complaint.urgency}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                            {complaint.description || 'No description provided'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                            {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusStyles.badge}`}>
                              {statusStyles.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-emerald-600 font-bold hover:text-emerald-700 hover:bg-white/60 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedComplaint(complaint);
                              }}
                            >
                              {complaint.status === 'ACCEPTED' ? 'View' : 'Review'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Complaint detail modal — review, accept, or reject */}
      <Dialog open={!!selectedComplaint} onOpenChange={(open) => !open && setSelectedComplaint(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedComplaint && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                  <DialogTitle className="text-2xl font-bold">
                    {selectedComplaint.issueType || 'Complaint Details'}
                  </DialogTitle>
                  <Badge 
                    className={`${
                      selectedComplaint.urgency === 'High' ? 'bg-red-500' :
                      selectedComplaint.urgency === 'Medium' ? 'bg-orange-400' :
                      'bg-emerald-500'
                    } text-white border-none font-bold`}
                  >
                    {selectedComplaint.urgency || 'Normal'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {selectedComplaint.createdAt ? new Date(selectedComplaint.createdAt).toLocaleString() : 'N/A'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Badge variant="outline">{selectedComplaint.status || 'PENDING'}</Badge>
                  </span>
                </div>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                {/* Photo Section */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
                    <Layers className="w-4 h-4" />
                    Evidence Photos
                  </h4>
                  {selectedComplaint.imageUrl ? (
                    <div className="aspect-video w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
                      <img 
                        src={selectedComplaint.imageUrl.startsWith('http') 
                          ? selectedComplaint.imageUrl 
                          : `${API_BASE}/${selectedComplaint.imageUrl}`} 
                        alt="Complaint evidence"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                      <Layers className="w-10 h-10 mb-2 opacity-20" />
                      <p className="text-sm">No photos uploaded by citizen</p>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Description</h4>
                  <div className="p-4 bg-gray-50 rounded-xl text-gray-700 leading-relaxed">
                    {selectedComplaint.description || 'No description provided'}
                    {selectedComplaint.otherIssueDetail && (
                      <p className="mt-3 pt-3 border-t border-gray-200 text-emerald-700 font-medium italic">
                        "Other" Issue Detail: {selectedComplaint.otherIssueDetail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Waste Type</p>
                    <p className="text-gray-900 font-semibold">{selectedComplaint.wasteType || 'Not specified'}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Location</p>
                    <div className="flex items-center gap-1.5 text-gray-900 font-semibold">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <span className="truncate">
                        {selectedComplaint.latitude && selectedComplaint.longitude 
                          ? `${selectedComplaint.latitude}, ${selectedComplaint.longitude}`
                          : selectedComplaint.location || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="pt-6 border-t border-gray-100 flex gap-3">
                  <Button 
                    className={`flex-1 h-11 font-bold ${
                      selectedComplaint.status === 'ACCEPTED' 
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                    disabled={selectedComplaint.status === 'ACCEPTED'}
                    onClick={async () => {
                      await updateComplaint(selectedComplaint.id, 'ACCEPTED');
                      setSelectedComplaint(null);
                    }}
                  >
                    {selectedComplaint.status === 'ACCEPTED' ? 'Accepted' : 'Accept Report'}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-11 font-bold"
                    onClick={async () => {
                      await updateComplaint(selectedComplaint.id, 'REJECTED');
                      setSelectedComplaint(null);
                    }}
                  >
                    Reject Issue
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Event suggestions awaiting admin approval */}
      {showEventSuggestions && (
      <div className="space-y-4">
        {/* Pending event suggestions section header */}
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          Event Suggestions
          <Badge variant="secondary" className="rounded-full bg-gray-100 text-gray-600 font-semibold border-none">
            {events.length}
          </Badge>
        </h3>

        {events.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">No pending event suggestions.</p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Card grid view */}
            {events.map((event) => (
              <Card key={event.id} className="bg-white border-none shadow-sm overflow-hidden">
                <div className="h-1.5 bg-blue-500" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-base font-semibold text-gray-900">{event.title || 'Untitled'}</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 shrink-0">
                      Pending
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3 mb-3">
                    {event.description || 'No description provided'}
                  </p>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-4">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {event.eventDate || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                      onClick={() => updateEvent(event.id, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs bg-white/80"
                      onClick={() => {
                        setSelectedEvent(event);
                        setIsRejectModalOpen(true);
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white border-none shadow-sm overflow-hidden">
            {/* Table view */}
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white">
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Title</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Event Date</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Description</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Status</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className="border-b border-white/60 transition-colors bg-blue-50 hover:bg-blue-100/70">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{event.title || 'Untitled'}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {event.eventDate || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                          {event.description || 'No description provided'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                            Pending
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                              onClick={() => updateEvent(event.id, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs bg-white/80"
                              onClick={() => {
                                setSelectedEvent(event);
                                setIsRejectModalOpen(true);
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Approved and active events (read-only list) */}
      {showActiveEvents && (
      <div className="space-y-4">
        {/* Active events section header */}
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          Approved & Active Events
          <Badge variant="secondary" className="rounded-full bg-emerald-100 text-emerald-700 font-semibold border-none">
            {activeEvents.length}
          </Badge>
        </h3>

        {activeEvents.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400">No active events yet.</p>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Card grid view */}
            {activeEvents.map((event) => (
              <Card key={event.id} className="bg-white border-none shadow-sm overflow-hidden">
                <div className="h-1.5 bg-green-500" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-base font-semibold text-gray-900">{event.title || 'Untitled'}</p>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 shrink-0">
                      Active
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3 mb-3">
                    {event.description || 'No description provided'}
                  </p>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {event.eventDate || 'N/A'}
                    </div>
                    <span className="text-gray-500">#{event.id}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-white border-none shadow-sm overflow-hidden">
            {/* Table view */}
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-white">
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Title</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Event Date</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Description</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Status</th>
                      <th className="px-6 py-4 font-semibold text-gray-600 text-sm">ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeEvents.map((event) => (
                      <tr key={event.id} className="border-b border-white/60 transition-colors bg-green-50 hover:bg-green-100/70">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{event.title || 'Untitled'}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {event.eventDate || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">
                          {event.description || 'No description provided'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            Active
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">#{event.id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Event rejection modal — reason required before rejecting a suggestion */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Event Suggestion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Reason for Rejection</label>
              <Input 
                placeholder="Explain why this suggestion is being rejected..." 
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setIsRejectModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (selectedEvent) {
                    updateEvent(selectedEvent.id, 'reject', rejectionReason);
                    setIsRejectModalOpen(false);
                    setRejectionReason("");
                  }
                }}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
