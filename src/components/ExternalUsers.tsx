'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ImageIcon,
  MapPin,
  MessageSquare,
  UserCircle,
  UserMinus,
  UserPlus,
  Users,
  X,
  EyeOff,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

type Tab = 'citizens' | 'collectors';
type CitizensSection = 'users' | 'complaints' | 'events';
type CollectorsSection = 'pending' | 'active' | 'revoked';

interface SubSectionItem<T extends string> {
  id: T;
  label: string;
  icon: React.ReactNode;
  count?: number;
  description: string;
}

function SubSectionNav<T extends string>({
  items,
  active,
  onChange,
}: {
  items: SubSectionItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  const activeItem = items.find((item) => item.id === active);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active === item.id
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active === item.id ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
                  }`}
              >
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {activeItem && (
        <p className="text-sm text-gray-500">{activeItem.description}</p>
      )}
    </div>
  );
}

interface ComplaintItem {
  id: number;
  description?: string;
  status?: string;
  location?: string;
  imageUrl?: string;
  resolutionNotes?: string;
  createdAt?: string;
}

interface EventItem {
  id: number;
  title?: string;
  description?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  council?: string;
  category?: string;
  imageUrl?: string;
  maxParticipants?: number;
  enrolledCount?: number;
  status?: string;
}

interface CitizenUser {
  empId: number;
  empName?: string;
  email?: string;
  phone?: string;
  council?: string;
  address?: string;
  area?: string;
  reportCount?: number;
  createdAt?: string;
}

interface ThirdPartyCollector {
  empId: number;
  empName?: string;
  email?: string;
  phone?: string;
  NIC?: string;
  nic?: string;
  company?: string;
  contractId?: string;
  contractStart?: string;
  contractEnd?: string;
  defaultAddress?: string;
  assignedCouncils?: string;
  nicPhotoUrl?: string;
  nicPhotoBackUrl?: string;
  dateOfBirth?: string;
  createdAt?: string;
  registrationStatus?: string;
  role?: string;
  council?: string;
}


function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081').replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function matchesCouncil(
  councilName: string | undefined,
  ...values: (string | undefined | null)[]
): boolean {
  if (!councilName) return true;
  const needle = councilName.trim().toLowerCase();
  return values.some((v) => {
    if (!v) return false;
    return v.split(',').some((part) => part.trim().toLowerCase() === needle);
  });
}

function statusBadgeClass(status?: string) {
  const s = (status || '').toLowerCase();
  if (s.includes('pending') || s === 'new') return 'bg-amber-100 text-amber-800';
  if (s.includes('reject')) return 'bg-red-100 text-red-800';
  if (s.includes('complet') || s.includes('approv') || s === 'active') return 'bg-green-100 text-green-800';
  if (s.includes('progress')) return 'bg-blue-100 text-blue-800';
  return 'bg-gray-100 text-gray-700';
}

function formatTimeLabel(time?: string): string {
  if (!time) return '';
  const [hourPart, minutePart = '00'] = time.split(':');
  const hour = parseInt(hourPart, 10);
  if (Number.isNaN(hour)) return time;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${minutePart.slice(0, 2)} ${ampm}`;
}

function formatTimeRange(start?: string, end?: string): string {
  if (start && end) return `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;
  if (start) return formatTimeLabel(start);
  if (end) return formatTimeLabel(end);
  return '';
}

function categoryBadgeClass(category?: string) {
  const c = (category || 'Community').toLowerCase();
  if (c.includes('cleanup')) return 'bg-emerald-100 text-emerald-800';
  if (c.includes('workshop')) return 'bg-purple-100 text-purple-800';
  return 'bg-blue-100 text-blue-800';
}

export function ExternalUsers({ council }: { council?: { name?: string } | null }) {
  const [tab, setTab] = useState<Tab>('citizens');

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-gray-900 mb-1">External Users</h2>
        <p className="text-gray-600">Citizen complaints, events, and third-party collector registrations</p>
        {council?.name && (
          <p className="text-sm text-gray-500 mt-1">Council context: {council.name}</p>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-1">
        <button
          type="button"
          onClick={() => setTab('citizens')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${tab === 'citizens'
              ? 'bg-green-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          <Users className="w-4 h-4" />
          Citizens
        </button>
        <button
          type="button"
          onClick={() => setTab('collectors')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${tab === 'collectors'
              ? 'bg-green-600 text-white'
              : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          <Building2 className="w-4 h-4" />
          Third-Party Collectors
        </button>
      </div>

      {tab === 'citizens' ? <CitizensTab council={council} /> : <CollectorsTab council={council} />}
    </div>
  );
}

function councilQuery(councilName?: string): string {
  return councilName ? `?council=${encodeURIComponent(councilName)}` : '';
}

function CitizensTab({ council }: { council?: { name?: string } | null }) {
  const [section, setSection] = useState<CitizensSection>('users');
  const [citizens, setCitizens] = useState<CitizenUser[]>([]);
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaintId, setSelectedComplaintId] = useState<number | null>(null);
  const [complaintDetail, setComplaintDetail] = useState<ComplaintItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [complaintStatus, setComplaintStatus] = useState('inprogress');
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    location: '',
    category: 'Community',
    maxParticipants: '',
    imageUrl: '',
    imagePreview: '',
  });
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const councilName = council?.name;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [citizensRes, complaintsRes, eventsRes] = await Promise.all([
        apiFetch<{ success?: boolean; data?: CitizenUser[] }>(`/api/admin/citizens${councilQuery(councilName)}`),
        apiFetch<ComplaintItem[]>('/api/complaints'),
        apiFetch<EventItem[]>('/api/events/suggestions'),
      ]);

      const citizenList = citizensRes.data?.success && Array.isArray(citizensRes.data.data)
        ? citizensRes.data.data
        : Array.isArray(citizensRes.data)
          ? (citizensRes.data as CitizenUser[])
          : [];

      const rawComplaints = Array.isArray(complaintsRes.data) ? complaintsRes.data : [];
      const rawEvents = Array.isArray(eventsRes.data) ? eventsRes.data : [];

      setCitizens(citizenList);
      setComplaints(
        councilName
          ? rawComplaints.filter((c) => matchesCouncil(councilName, c.location))
          : rawComplaints
      );
      setEvents(
        councilName
          ? rawEvents.filter((e) => matchesCouncil(councilName, e.council, e.location))
          : rawEvents
      );
    } catch {
      toast.error('Failed to load citizen data');
    } finally {
      setLoading(false);
    }
  }, [councilName]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openComplaint = async (id: number) => {
    setSelectedComplaintId(id);
    setDetailLoading(true);
    try {
      const { data } = await apiFetch<ComplaintItem>(`/api/complaints/${id}`);
      setComplaintDetail(data);
      setResolutionNotes(data.resolutionNotes || '');
      setComplaintStatus(data.status || 'inprogress');
    } catch {
      toast.error('Could not load complaint details');
      setSelectedComplaintId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveComplaint = async () => {
    if (!selectedComplaintId) return;
    try {
      const { response } = await apiFetch(`/api/complaints/${selectedComplaintId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: complaintStatus, resolutionNotes }),
      });
      if (!response.ok) throw new Error('Update failed');
      toast.success('Complaint updated');
      setSelectedComplaintId(null);
      setComplaintDetail(null);
      void loadData();
    } catch {
      toast.error('Failed to update complaint');
    }
  };

  const updateEvent = async (id: number, action: 'approve' | 'reject') => {
    try {
      const { response } = await apiFetch(`/api/events/${id}/${action}`, {
        method: 'PATCH',
        body: action === 'reject' ? JSON.stringify({ reason: 'Rejected by admin' }) : undefined,
      });
      if (!response.ok) throw new Error('Event action failed');
      toast.success(action === 'approve' ? 'Event approved' : 'Event rejected');
      void loadData();
    } catch {
      toast.error(`Failed to ${action} event`);
    }
  };

  const handleEventImage = async (file: File | null) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      const { response, data } = await apiFetch<{ imageUrl?: string }>('/api/events/upload-image', {
        method: 'POST',
        body: form,
      });
      if (!response.ok || !data.imageUrl) throw new Error('Upload failed');
      setEventForm((p) => ({
        ...p,
        imageUrl: data.imageUrl || '',
        imagePreview: resolveMediaUrl(data.imageUrl) || '',
      }));
      toast.success('Event image uploaded');
    } catch {
      toast.error('Failed to upload event image');
    } finally {
      setUploadingImage(false);
    }
  };

  const hideCitizen = async (empId: number) => {
    if (!confirm('Hide this citizen from the admin list?')) return;
    try {
      const { response } = await apiFetch(`/api/admin/citizens/${empId}/hide`, { method: 'POST' });
      if (!response.ok) throw new Error('Hide failed');
      toast.success('Citizen hidden');
      void loadData();
    } catch {
      toast.error('Failed to hide citizen');
    }
  };

  const deleteCitizen = async (empId: number) => {
    if (!confirm('Delete this citizen permanently? This cannot be undone.')) return;
    try {
      const { response } = await apiFetch(`/api/admin/citizens/${empId}`, { method: 'DELETE' });
      if (response.status === 409) {
        toast.error('Cannot delete citizen with linked records');
        return;
      }
      if (!response.ok) throw new Error('Delete failed');
      toast.success('Citizen deleted');
      void loadData();
    } catch {
      toast.error('Failed to delete citizen');
    }
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim() || !eventForm.eventDate) {
      toast.error('Title and date are required');
      return;
    }
    setCreatingEvent(true);
    try {
      const maxParticipants = eventForm.maxParticipants
        ? parseInt(eventForm.maxParticipants, 10)
        : undefined;
      const { response } = await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title: eventForm.title.trim(),
          description: eventForm.description.trim() || undefined,
          eventDate: eventForm.eventDate,
          startTime: eventForm.startTime || undefined,
          endTime: eventForm.endTime || undefined,
          location: eventForm.location.trim() || councilName || undefined,
          category: eventForm.category,
          imageUrl: eventForm.imageUrl || undefined,
          maxParticipants: Number.isFinite(maxParticipants) ? maxParticipants : undefined,
          council: councilName || undefined,
        }),
      });
      if (!response.ok) throw new Error('Create failed');
      toast.success('Event created');
      setEventForm({
        title: '',
        description: '',
        eventDate: '',
        startTime: '',
        endTime: '',
        location: '',
        category: 'Community',
        maxParticipants: '',
        imageUrl: '',
        imagePreview: '',
      });
      void loadData();
    } catch {
      toast.error('Could not create event');
    } finally {
      setCreatingEvent(false);
    }
  };

  const detailImage = resolveMediaUrl(complaintDetail?.imageUrl);

  const citizenSections: SubSectionItem<CitizensSection>[] = [
    {
      id: 'users',
      label: 'Users',
      icon: <UserCircle className="w-4 h-4" />,
      count: citizens.length,
      description: 'Registered citizens in the selected council.',
    },
    {
      id: 'complaints',
      label: 'Complaints',
      icon: <MessageSquare className="w-4 h-4" />,
      count: complaints.length,
      description: 'Review and resolve citizen waste complaints.',
    },
    {
      id: 'events',
      label: 'Events',
      icon: <Calendar className="w-4 h-4" />,
      count: events.length,
      description: 'Approve event suggestions and publish new council events.',
    },
  ];

  return (
    <div className="space-y-6">
      <SubSectionNav items={citizenSections} active={section} onChange={setSection} />

      {section === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>Citizen Users</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading citizens...</p>
            ) : citizens.length === 0 ? (
              <p className="text-gray-500">No citizens found for this council.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Council</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {citizens.map((citizen) => (
                      <TableRow key={citizen.empId}>
                        <TableCell className="font-medium">{citizen.empId}</TableCell>
                        <TableCell>{citizen.empName || '—'}</TableCell>
                        <TableCell>{citizen.email || '—'}</TableCell>
                        <TableCell>{citizen.phone || '—'}</TableCell>
                        <TableCell>{citizen.council || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => void hideCitizen(citizen.empId)}>
                              <EyeOff className="w-3.5 h-3.5 mr-1" />
                              Hide
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void deleteCitizen(citizen.empId)}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {section === 'complaints' && (
        <Card>
          <CardHeader>
            <CardTitle>Citizen Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading complaints...</p>
            ) : complaints.length === 0 ? (
              <p className="text-gray-500">No complaints found.</p>
            ) : (
              <div className="space-y-2">
                {complaints.map((complaint) => (
                  <button
                    key={complaint.id}
                    type="button"
                    onClick={() => void openComplaint(complaint.id)}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50/30 transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-gray-900 font-medium truncate">
                        {complaint.description?.slice(0, 80) || `Complaint #${complaint.id}`}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{complaint.location || 'No location'}</p>
                      {complaint.createdAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(complaint.createdAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Badge className={statusBadgeClass(complaint.status)}>{complaint.status || 'new'}</Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {section === 'events' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Event Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-gray-500">Loading suggestions...</p>
              ) : events.length === 0 ? (
                <p className="text-gray-500">No pending event suggestions.</p>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => {
                    const eventImage = resolveMediaUrl(event.imageUrl);
                    const timeRange = formatTimeRange(event.startTime, event.endTime);
                    const participants =
                      event.maxParticipants != null
                        ? `${event.enrolledCount ?? 0} / ${event.maxParticipants} participants`
                        : null;
                    return (
                      <div
                        key={event.id}
                        className="border border-gray-200 rounded-xl overflow-hidden flex flex-col sm:flex-row"
                      >
                        {eventImage ? (
                          <a href={eventImage} target="_blank" rel="noreferrer" className="sm:w-40 shrink-0">
                            <img
                              src={eventImage}
                              alt={event.title || 'Event'}
                              className="w-full h-32 sm:h-full object-cover bg-gray-100"
                            />
                          </a>
                        ) : (
                          <div className="sm:w-40 shrink-0 h-32 sm:h-auto flex items-center justify-center bg-gray-50 text-gray-400">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}
                        <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="min-w-0">
                            {event.category && (
                              <Badge className={`mb-2 ${categoryBadgeClass(event.category)}`}>{event.category}</Badge>
                            )}
                            <p className="text-gray-900 font-semibold">{event.title}</p>
                            <p className="text-sm text-gray-600 mt-1">{event.description || 'No description'}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
                              {event.eventDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {event.eventDate}
                                </span>
                              )}
                              {timeRange && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {timeRange}
                                </span>
                              )}
                              {event.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </span>
                              )}
                              {participants && <span>{participants}</span>}
                              {event.council && <span>Council: {event.council}</span>}
                            </div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => void updateEvent(event.id, 'approve')}>
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void updateEvent(event.id, 'reject')}>
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Create Council Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createEvent} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Event title *"
                  value={eventForm.title}
                  onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
                  required
                />
                <Input
                  type="date"
                  value={eventForm.eventDate}
                  onChange={(e) => setEventForm((p) => ({ ...p, eventDate: e.target.value }))}
                  required
                />
                <Input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm((p) => ({ ...p, startTime: e.target.value }))}
                  title="Start time"
                />
                <Input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm((p) => ({ ...p, endTime: e.target.value }))}
                  title="End time"
                />
                <Input
                  placeholder="Location"
                  value={eventForm.location}
                  onChange={(e) => setEventForm((p) => ({ ...p, location: e.target.value }))}
                />
                <Input
                  placeholder="Category (e.g. Cleanup, Workshop)"
                  value={eventForm.category}
                  onChange={(e) => setEventForm((p) => ({ ...p, category: e.target.value }))}
                />
                <Input
                  type="number"
                  min={1}
                  placeholder="Max participants"
                  value={eventForm.maxParticipants}
                  onChange={(e) => setEventForm((p) => ({ ...p, maxParticipants: e.target.value }))}
                />
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleEventImage(e.target.files?.[0] || null)}
                      disabled={uploadingImage}
                    />
                    <span className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 w-full justify-center">
                      <ImageIcon className="w-4 h-4" />
                      {uploadingImage ? 'Uploading...' : 'Upload event photo'}
                    </span>
                  </label>
                </div>
                <div className="md:col-span-2">
                  <Input
                    placeholder="Description"
                    value={eventForm.description}
                    onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
                {eventForm.imagePreview && (
                  <div className="md:col-span-2">
                    <img
                      src={eventForm.imagePreview}
                      alt="Event preview"
                      className="rounded-lg border border-gray-200 max-h-40 object-cover"
                    />
                  </div>
                )}
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    type="submit"
                    disabled={creatingEvent || uploadingImage}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {creatingEvent ? 'Creating...' : 'Publish Event'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {selectedComplaintId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Complaint #{selectedComplaintId}</h3>
              <button type="button" onClick={() => { setSelectedComplaintId(null); setComplaintDetail(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading ? (
                <p className="text-gray-500">Loading...</p>
              ) : complaintDetail ? (
                <>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{complaintDetail.description || 'No description'}</p>
                  <p className="text-xs text-gray-500">{complaintDetail.location || 'No location'}</p>
                  {detailImage ? (
                    <a href={detailImage} target="_blank" rel="noreferrer" className="block">
                      <img src={detailImage} alt="Complaint" className="rounded-lg border border-gray-200 max-h-48 object-cover w-full" />
                    </a>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-gray-400 p-4 border border-dashed rounded-lg">
                      <ImageIcon className="w-4 h-4" />
                      No image attached
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={complaintStatus}
                      onChange={(e) => setComplaintStatus(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="new">New</option>
                      <option value="inprogress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resolution notes</label>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Response to citizen..."
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => { setSelectedComplaintId(null); setComplaintDetail(null); }}>
                      Cancel
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={() => void saveComplaint()}>
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollectorsTab({ council }: { council?: { name?: string } | null }) {
  const [section, setSection] = useState<CollectorsSection>('pending');
  const [pending, setPending] = useState<ThirdPartyCollector[]>([]);
  const [active, setActive] = useState<ThirdPartyCollector[]>([]);
  const [revoked, setRevoked] = useState<ThirdPartyCollector[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPendingId, setExpandedPendingId] = useState<number | null>(null);
  const [expandedActiveId, setExpandedActiveId] = useState<number | null>(null);
  const [expandedRevokedId, setExpandedRevokedId] = useState<number | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});
  const [revokeReasons, setRevokeReasons] = useState<Record<number, string>>({});
  const [actingId, setActingId] = useState<number | null>(null);

  const councilName = council?.name;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const query = councilQuery(councilName);
      const [pendingRes, activeRes, revokedRes] = await Promise.all([
        apiFetch<{ success?: boolean; data?: ThirdPartyCollector[] }>(`/api/auth/thirdparty-register/pending${query}`),
        apiFetch<{ success?: boolean; data?: ThirdPartyCollector[] }>(`/api/auth/thirdparty-register/active${query}`),
        apiFetch<{ success?: boolean; data?: ThirdPartyCollector[] }>(`/api/auth/thirdparty-register/revoked${query}`),
      ]);

      const pendingList = pendingRes.data?.success && Array.isArray(pendingRes.data.data)
        ? pendingRes.data.data
        : Array.isArray(pendingRes.data)
          ? (pendingRes.data as ThirdPartyCollector[])
          : [];

      const activeList = activeRes.data?.success && Array.isArray(activeRes.data.data)
        ? activeRes.data.data
        : Array.isArray(activeRes.data)
          ? (activeRes.data as ThirdPartyCollector[])
          : [];

      const revokedList = revokedRes.data?.success && Array.isArray(revokedRes.data.data)
        ? revokedRes.data.data
        : Array.isArray(revokedRes.data)
          ? (revokedRes.data as ThirdPartyCollector[])
          : [];

      setPending(pendingList);
      setActive(activeList);
      setRevoked(revokedList);
    } catch {
      toast.error('Failed to load collector data');
    } finally {
      setLoading(false);
    }
  }, [councilName]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const togglePendingExpanded = (empId: number) => {
    setExpandedPendingId((current) => (current === empId ? null : empId));
  };

  const toggleActiveExpanded = (empId: number) => {
    setExpandedActiveId((current) => (current === empId ? null : empId));
  };

  const toggleRevokedExpanded = (empId: number) => {
    setExpandedRevokedId((current) => (current === empId ? null : empId));
  };

  const approve = async (empId: number) => {
    setActingId(empId);
    try {
      const { response } = await apiFetch(`/api/auth/thirdparty-register/${empId}/approve`, { method: 'POST' });
      if (!response.ok) throw new Error('Approve failed');
      toast.success('Registration approved');
      setExpandedPendingId(null);
      void loadData();
    } catch {
      toast.error('Failed to approve registration');
    } finally {
      setActingId(null);
    }
  };

  const reject = async (empId: number) => {
    setActingId(empId);
    try {
      const reason = rejectReasons[empId] || 'Rejected by admin';
      const { response } = await apiFetch(`/api/auth/thirdparty-register/${empId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Reject failed');
      toast.success('Registration rejected');
      setExpandedPendingId(null);
      setRejectReasons((prev) => {
        const next = { ...prev };
        delete next[empId];
        return next;
      });
      void loadData();
    } catch {
      toast.error('Failed to reject registration');
    } finally {
      setActingId(null);
    }
  };

  const unrevoke = async (empId: number) => {
    setActingId(empId);
    try {
      const { response } = await apiFetch(`/api/auth/thirdparty-register/${empId}/unrevoke`, { method: 'POST' });
      if (!response.ok) throw new Error('Unrevoke failed');
      toast.success('Collector access restored');
      setExpandedRevokedId(null);
      void loadData();
    } catch {
      toast.error('Failed to restore collector access');
    } finally {
      setActingId(null);
    }
  };

  const hideCollector = async (empId: number) => {
    setActingId(empId);
    try {
      const { response } = await apiFetch(`/api/auth/thirdparty-register/${empId}/hide`, { method: 'POST' });
      if (!response.ok) throw new Error('Hide failed');
      toast.success('Collector hidden');
      setExpandedPendingId(null);
      setExpandedActiveId(null);
      setExpandedRevokedId(null);
      void loadData();
    } catch {
      toast.error('Failed to hide collector');
    } finally {
      setActingId(null);
    }
  };

  const deleteCollector = async (empId: number) => {
    if (!confirm('Delete this collector permanently? This cannot be undone.')) return;
    setActingId(empId);
    try {
      const { response } = await apiFetch(`/api/auth/thirdparty-register/${empId}`, { method: 'DELETE' });
      if (response.status === 409) {
        toast.error('Cannot delete collector with linked records');
        return;
      }
      if (!response.ok) throw new Error('Delete failed');
      toast.success('Collector deleted');
      setExpandedPendingId(null);
      setExpandedActiveId(null);
      setExpandedRevokedId(null);
      void loadData();
    } catch {
      toast.error('Failed to delete collector');
    } finally {
      setActingId(null);
    }
  };

  const revoke = async (empId: number) => {
    setActingId(empId);
    try {
      const reason = revokeReasons[empId] || 'Revoked by admin';
      const { response } = await apiFetch(`/api/auth/thirdparty-register/${empId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Revoke failed');
      toast.success('Collector access revoked');
      setExpandedActiveId(null);
      setRevokeReasons((prev) => {
        const next = { ...prev };
        delete next[empId];
        return next;
      });
      void loadData();
    } catch {
      toast.error('Failed to revoke collector access');
    } finally {
      setActingId(null);
    }
  };

  const collectorSections: SubSectionItem<CollectorsSection>[] = [
    {
      id: 'pending',
      label: 'Pending',
      icon: <UserPlus className="w-4 h-4" />,
      count: pending.length,
      description: 'Review new third-party collector registration applications.',
    },
    {
      id: 'active',
      label: 'Active',
      icon: <Users className="w-4 h-4" />,
      count: active.length,
      description: 'Approved collectors assigned to this council.',
    },
    {
      id: 'revoked',
      label: 'Revoked',
      icon: <UserMinus className="w-4 h-4" />,
      count: revoked.length,
      description: 'Restore access for collectors revoked by admin.',
    },
  ];

  return (
    <div className="space-y-6">
      <SubSectionNav items={collectorSections} active={section} onChange={setSection} />

      {section === 'pending' && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading pending applications...</p>
            ) : pending.length === 0 ? (
              <p className="text-gray-500">No pending third-party registrations.</p>
            ) : (
              <div className="space-y-2">
                {pending.map((item) => {
                  const isOpen = expandedPendingId === item.empId;
                  const nicFront = resolveMediaUrl(item.nicPhotoUrl);
                  const nicBack = resolveMediaUrl(item.nicPhotoBackUrl);
                  const isActing = actingId === item.empId;
                  return (
                    <div
                      key={item.empId}
                      className={`border rounded-lg overflow-hidden transition-colors ${isOpen ? 'border-green-400 shadow-sm' : 'border-gray-200'
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => togglePendingExpanded(item.empId)}
                        className={`w-full text-left p-4 flex items-center justify-between gap-4 ${isOpen ? 'bg-green-50/40' : 'hover:bg-gray-50'
                          }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{item.empName || item.email}</p>
                          <p className="text-sm text-gray-500">{item.email}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {[item.company, item.assignedCouncils].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-amber-100 text-amber-800">PENDING</Badge>
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-200 p-4 space-y-4 bg-white">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div><span className="text-gray-500">Email:</span> {item.email || '—'}</div>
                            <div><span className="text-gray-500">Phone:</span> {item.phone || '—'}</div>
                            <div><span className="text-gray-500">NIC:</span> {item.NIC || item.nic || '—'}</div>
                            <div><span className="text-gray-500">DOB:</span> {item.dateOfBirth || '—'}</div>
                            <div><span className="text-gray-500">Company:</span> {item.company || '—'}</div>
                            <div><span className="text-gray-500">Contract ID:</span> {item.contractId || '—'}</div>
                            <div><span className="text-gray-500">Contract start:</span> {item.contractStart || '—'}</div>
                            <div><span className="text-gray-500">Contract end:</span> {item.contractEnd || '—'}</div>
                            <div className="sm:col-span-2"><span className="text-gray-500">Councils:</span> {item.assignedCouncils || '—'}</div>
                            <div className="sm:col-span-2"><span className="text-gray-500">Address:</span> {item.defaultAddress || '—'}</div>
                            {item.createdAt && (
                              <div className="sm:col-span-2 text-xs text-gray-400">
                                Submitted: {new Date(item.createdAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {nicFront ? (
                              <a href={nicFront} target="_blank" rel="noreferrer">
                                <img src={nicFront} alt="NIC front" className="rounded-lg border max-h-40 object-contain w-full bg-gray-50" />
                              </a>
                            ) : (
                              <div className="text-xs text-gray-400 border border-dashed rounded-lg p-6 text-center">No NIC front photo</div>
                            )}
                            {nicBack ? (
                              <a href={nicBack} target="_blank" rel="noreferrer">
                                <img src={nicBack} alt="NIC back" className="rounded-lg border max-h-40 object-contain w-full bg-gray-50" />
                              </a>
                            ) : (
                              <div className="text-xs text-gray-400 border border-dashed rounded-lg p-6 text-center">No NIC back photo</div>
                            )}
                          </div>
                          <Input
                            placeholder="Rejection reason (optional)"
                            value={rejectReasons[item.empId] || ''}
                            onChange={(e) =>
                              setRejectReasons((prev) => ({ ...prev, [item.empId]: e.target.value }))
                            }
                          />
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button variant="outline" onClick={() => setExpandedPendingId(null)} disabled={isActing}>
                              Collapse
                            </Button>
                            <Button variant="outline" onClick={() => void hideCollector(item.empId)} disabled={isActing}>
                              <EyeOff className="w-3.5 h-3.5 mr-1" />
                              Hide
                            </Button>
                            <Button variant="outline" onClick={() => void deleteCollector(item.empId)} disabled={isActing}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete
                            </Button>
                            <Button variant="outline" onClick={() => void reject(item.empId)} disabled={isActing}>
                              Reject
                            </Button>
                            <Button
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => void approve(item.empId)}
                              disabled={isActing}
                            >
                              {isActing ? 'Processing...' : 'Approve'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {section === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle>Active Collectors</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading collectors...</p>
            ) : active.length === 0 ? (
              <p className="text-gray-500">No active third-party collectors.</p>
            ) : (
              <div className="space-y-2">
                {active.map((collector) => {
                  const isOpen = expandedActiveId === collector.empId;
                  const nicFront = resolveMediaUrl(collector.nicPhotoUrl);
                  const nicBack = resolveMediaUrl(collector.nicPhotoBackUrl);
                  const isActing = actingId === collector.empId;
                  return (
                    <div
                      key={collector.empId}
                      className={`border rounded-lg overflow-hidden transition-colors ${isOpen ? 'border-green-400 shadow-sm' : 'border-gray-200'
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleActiveExpanded(collector.empId)}
                        className={`w-full text-left p-4 flex items-center justify-between gap-4 ${isOpen ? 'bg-green-50/40' : 'hover:bg-gray-50'
                          }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{collector.empName || collector.email}</p>
                          <p className="text-sm text-gray-500">{collector.email}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {[collector.company, collector.assignedCouncils].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-green-100 text-green-800">ACTIVE</Badge>
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-200 p-4 space-y-4 bg-white">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div><span className="text-gray-500">Email:</span> {collector.email || '—'}</div>
                            <div><span className="text-gray-500">Phone:</span> {collector.phone || '—'}</div>
                            <div><span className="text-gray-500">NIC:</span> {collector.NIC || collector.nic || '—'}</div>
                            <div><span className="text-gray-500">Company:</span> {collector.company || '—'}</div>
                            <div><span className="text-gray-500">Contract ID:</span> {collector.contractId || '—'}</div>
                            <div><span className="text-gray-500">Contract:</span> {[collector.contractStart, collector.contractEnd].filter(Boolean).join(' → ') || '—'}</div>
                            <div className="sm:col-span-2"><span className="text-gray-500">Assigned councils:</span> {collector.assignedCouncils || '—'}</div>
                            <div className="sm:col-span-2"><span className="text-gray-500">Address:</span> {collector.defaultAddress || '—'}</div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {nicFront ? (
                              <a href={nicFront} target="_blank" rel="noreferrer">
                                <img src={nicFront} alt="NIC front" className="rounded-lg border max-h-40 object-contain w-full bg-gray-50" />
                              </a>
                            ) : (
                              <div className="text-xs text-gray-400 border border-dashed rounded-lg p-6 text-center">No NIC front photo</div>
                            )}
                            {nicBack ? (
                              <a href={nicBack} target="_blank" rel="noreferrer">
                                <img src={nicBack} alt="NIC back" className="rounded-lg border max-h-40 object-contain w-full bg-gray-50" />
                              </a>
                            ) : (
                              <div className="text-xs text-gray-400 border border-dashed rounded-lg p-6 text-center">No NIC back photo</div>
                            )}
                          </div>
                          <Input
                            placeholder="Revoke reason (optional)"
                            value={revokeReasons[collector.empId] || ''}
                            onChange={(e) =>
                              setRevokeReasons((prev) => ({ ...prev, [collector.empId]: e.target.value }))
                            }
                          />
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button variant="outline" onClick={() => setExpandedActiveId(null)} disabled={isActing}>
                              Collapse
                            </Button>
                            <Button variant="outline" onClick={() => void hideCollector(collector.empId)} disabled={isActing}>
                              <EyeOff className="w-3.5 h-3.5 mr-1" />
                              Hide
                            </Button>
                            <Button variant="outline" onClick={() => void deleteCollector(collector.empId)} disabled={isActing}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete
                            </Button>
                            <Button variant="outline" onClick={() => void revoke(collector.empId)} disabled={isActing}>
                              Revoke Access
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {section === 'revoked' && (
        <Card>
          <CardHeader>
            <CardTitle>Revoked Collectors</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500">Loading revoked collectors...</p>
            ) : revoked.length === 0 ? (
              <p className="text-gray-500">No revoked third-party collectors.</p>
            ) : (
              <div className="space-y-2">
                {revoked.map((collector) => {
                  const isOpen = expandedRevokedId === collector.empId;
                  const isActing = actingId === collector.empId;
                  return (
                    <div
                      key={collector.empId}
                      className={`border rounded-lg overflow-hidden transition-colors ${isOpen ? 'border-amber-400 shadow-sm' : 'border-gray-200'
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleRevokedExpanded(collector.empId)}
                        className={`w-full text-left p-4 flex items-center justify-between gap-4 ${isOpen ? 'bg-amber-50/40' : 'hover:bg-gray-50'
                          }`}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{collector.empName || collector.email}</p>
                          <p className="text-sm text-gray-500">{collector.email}</p>
                          <p className="text-xs text-gray-400 mt-1">{collector.assignedCouncils || '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="bg-red-100 text-red-800">REVOKED</Badge>
                          {isOpen ? (
                            <ChevronUp className="w-5 h-5 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-200 p-4 space-y-4 bg-white">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div><span className="text-gray-500">Email:</span> {collector.email || '—'}</div>
                            <div><span className="text-gray-500">Phone:</span> {collector.phone || '—'}</div>
                            <div><span className="text-gray-500">Company:</span> {collector.company || '—'}</div>
                            <div className="sm:col-span-2"><span className="text-gray-500">Assigned councils:</span> {collector.assignedCouncils || '—'}</div>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button variant="outline" onClick={() => setExpandedRevokedId(null)} disabled={isActing}>
                              Collapse
                            </Button>
                            <Button variant="outline" onClick={() => void hideCollector(collector.empId)} disabled={isActing}>
                              <EyeOff className="w-3.5 h-3.5 mr-1" />
                              Hide
                            </Button>
                            <Button variant="outline" onClick={() => void deleteCollector(collector.empId)} disabled={isActing}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Delete
                            </Button>
                            <Button
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => void unrevoke(collector.empId)}
                              disabled={isActing}
                            >
                              {isActing ? 'Processing...' : 'Restore Access'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
