'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

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

export function CitizenManagement({ council }: { council?: { name?: string } | null }) {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [activeEvents, setActiveEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintItem | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  const tokenHeader = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const filteredComplaints = complaints.filter(c => 
    (c.issueType?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (c.description?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    c.id.toString().includes(searchQuery)
  );

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

  const loadData = async () => {
    setLoading(true);
    try {
      console.log("Fetching citizen management data...");
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
      <div>
        <h2 className="text-gray-900 mb-2 font-bold text-2xl">Citizen Management</h2>
        <p className="text-gray-600">Review citizen complaints and event submissions</p>
        {council?.name && (
          <Badge variant="outline" className="mt-2 bg-emerald-50 text-emerald-700 border-emerald-100">
            Council: {council.name}
          </Badge>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-white border-none shadow-sm">
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
        <Card className="bg-white border-none shadow-sm">
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
        <Card className="bg-white border-none shadow-sm">
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
        <Card className="bg-white border-none shadow-sm">
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
        <Card className="bg-white border-none shadow-sm">
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

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input 
          placeholder="Search by issue type, description or ID..." 
          className="pl-10 h-11 bg-white border-none shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            Citizen Complaints
            <Badge variant="secondary" className="rounded-full bg-gray-100 text-gray-600 font-semibold border-none">
              {filteredComplaints.length}
            </Badge>
          </h3>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-4" />
            <p className="text-gray-500">Fetching latest reports...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No complaints found</p>
            <p className="text-sm text-gray-400 mt-1">Check back later for new citizen submissions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredComplaints.map((complaint) => (
              <Card 
                key={complaint.id} 
                className="hover:shadow-md transition-all duration-300 border-none group cursor-pointer relative overflow-hidden"
                onClick={() => setSelectedComplaint(complaint)}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  complaint.urgency === 'High' ? 'bg-red-500' :
                  complaint.urgency === 'Medium' ? 'bg-orange-400' :
                  'bg-emerald-500'
                }`} />
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-gray-900 font-bold truncate">
                          {complaint.issueType || `Complaint #${complaint.id}`}
                        </h4>
                        {complaint.urgency && (
                          <Badge 
                            className={`text-[10px] py-0 px-1.5 border-none font-bold uppercase tracking-tight ${
                              complaint.urgency === 'High' ? 'bg-red-50 text-red-600' :
                              complaint.urgency === 'Medium' ? 'bg-orange-50 text-orange-600' :
                              'bg-emerald-50 text-emerald-600'
                            }`}
                            variant="outline"
                          >
                            {complaint.urgency}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[12px] text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        {complaint.createdAt ? new Date(complaint.createdAt).toLocaleDateString() : 'Just now'}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">
                    {complaint.description || 'No description provided'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <Badge 
                      className={`font-semibold rounded-lg ${
                        complaint.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700' :
                        complaint.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                        'bg-blue-50 text-blue-700'
                      }`}
                      variant="secondary"
                    >
                      {complaint.status === 'ACCEPTED' ? 'ACCEPTED' : (complaint.status || 'PENDING')}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-emerald-600 font-bold hover:text-emerald-700 hover:bg-emerald-50 text-xs">
                      {complaint.status === 'ACCEPTED' ? 'View Details' : 'Review Issue'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
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

      {/* Event Suggestions */}
      <div className="space-y-4">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Card key={event.id} className="hover:shadow-md transition-all duration-300 border-none group relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" />
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-gray-900 font-bold truncate">{event.title}</h4>
                      <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {event.eventDate || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">
                    {event.description || 'No description provided'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <Badge className="bg-blue-50 text-blue-700 font-semibold rounded-lg" variant="secondary">
                      PENDING
                    </Badge>
                    <div className="flex gap-2">
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
                        className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs"
                        onClick={() => {
                          setSelectedEvent(event);
                          setIsRejectModalOpen(true);
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Active & Approved Events */}
      <div className="space-y-4">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeEvents.map((event) => (
              <Card key={event.id} className="hover:shadow-md transition-all duration-300 border-none group relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="text-gray-900 font-bold truncate">{event.title}</h4>
                      <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {event.eventDate || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 h-10">
                    {event.description || 'No description provided'}
                  </p>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <Badge className="bg-emerald-50 text-emerald-700 font-semibold rounded-lg" variant="secondary">
                      ACTIVE
                    </Badge>
                    <div className="text-[10px] text-gray-400 font-medium">
                      ID: #{event.id}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Rejection Modal for Events */}
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
