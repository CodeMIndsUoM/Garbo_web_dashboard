'use client';

import { useEffect, useState } from 'react';
import { Calendar, MapPin, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

interface CollectorUser {
  empId: number;
  empName?: string;
  email?: string;
  role?: string;
  council?: string;
}

interface VehicleItem {
  id: number;
  vehicleCode?: string;
  licensePlate?: string;
  assignedDriverId?: number | null;
  assignedCouncil?: string;
}

interface EventSuggestion {
  id: number;
  title?: string;
  description?: string;
  location?: string;
  eventDate?: string;
}

const schedules = [
  {
    id: 1,
    council: 'Residential Council A',
    date: '2025-11-18',
    time: '08:00 AM - 12:00 PM',
    type: 'General Waste',
    crew: 'Team Alpha',
    status: 'scheduled',
    bins: 45,
  },
  {
    id: 2,
    council: 'Downtown Area',
    date: '2025-11-18',
    time: '01:00 PM - 04:00 PM',
    type: 'Recyclables',
    crew: 'Team Beta',
    status: 'in-progress',
    bins: 38,
  },
  {
    id: 3,
    council: 'Industrial Park',
    date: '2025-11-19',
    time: '07:00 AM - 11:00 AM',
    type: 'Mixed Waste',
    crew: 'Team Gamma',
    status: 'scheduled',
    bins: 52,
  },
  {
    id: 4,
    council: 'Shopping District',
    date: '2025-11-19',
    time: '02:00 PM - 06:00 PM',
    type: 'General Waste',
    crew: 'Team Alpha',
    status: 'scheduled',
    bins: 31,
  },
  {
    id: 5,
    council: 'Residential Council B',
    date: '2025-11-20',
    time: '08:00 AM - 12:00 PM',
    type: 'Organic Waste',
    crew: 'Team Delta',
    status: 'scheduled',
    bins: 48,
  },
  {
    id: 6,
    council: 'Business District',
    date: '2025-11-20',
    time: '01:00 PM - 05:00 PM',
    type: 'Recyclables',
    crew: 'Team Beta',
    status: 'scheduled',
    bins: 42,
  },
];

export function CollectionSchedule({ council }: { council?: { name?: string } | null }) {
  const [eventSuggestions, setEventSuggestions] = useState<EventSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [collectors, setCollectors] = useState<CollectorUser[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [councilFilterUnavailable, setCouncilFilterUnavailable] = useState(false);
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/events/suggestions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const json = await res.json();
      setEventSuggestions(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error('Failed to fetch event suggestions', e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchAssignmentData = async () => {
    setLoadingAssignments(true);
    try {
      const [usersRes, vehiclesRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/vehicles`, { headers: authHeaders() }),
      ]);
      const usersJson = await usersRes.json().catch(() => ({ data: [] }));
      const vehiclesJson = await vehiclesRes.json().catch(() => ({ data: [] }));
      const usersData: CollectorUser[] = Array.isArray(usersJson?.data) ? usersJson.data : [];
      const collectorUsers = usersData
        .filter((u: CollectorUser) => (u?.role || '').toString().toUpperCase() === 'COLLECTOR');
      const councilName = (council?.name || '').toLowerCase();
      const allVehicles: VehicleItem[] = Array.isArray(vehiclesJson?.data) ? vehiclesJson.data : [];
      const hasCouncilData =
        collectorUsers.some((u: CollectorUser) => typeof u.council === 'string') ||
        allVehicles.some((v: VehicleItem) => typeof v.assignedCouncil === 'string');
      setCouncilFilterUnavailable(Boolean(councilName) && !hasCouncilData && (collectorUsers.length > 0 || allVehicles.length > 0));
      const scopedCollectors = councilName
        ? collectorUsers.filter((u: CollectorUser) => (typeof u.council !== 'string' ? true : u.council.toLowerCase() === councilName))
        : collectorUsers;
      const scopedVehicles = councilName
        ? allVehicles.filter((v: VehicleItem) => (typeof v.assignedCouncil !== 'string' ? true : v.assignedCouncil.toLowerCase() === councilName))
        : allVehicles;
      const initialAssignments: Record<string, string> = {};
      for (const vehicle of scopedVehicles) {
        if (vehicle?.assignedDriverId != null) {
          initialAssignments[String(vehicle.assignedDriverId)] = String(vehicle.id);
        }
      }
      setCollectors(scopedCollectors);
      setVehicles(scopedVehicles);
      setAssignments(initialAssignments);
    } finally {
      setLoadingAssignments(false);
    }
  };

  useEffect(() => {
    fetchAssignmentData();
  }, []);

  const updateSuggestion = async (id: number, action: 'approve' | 'reject') => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/events/${id}/${action}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: action === 'reject' ? JSON.stringify({ reason: 'Rejected by admin' }) : undefined,
      });
      if (!res.ok) {
        alert(`Failed to ${action} event suggestion`);
        return;
      }
      fetchSuggestions();
    } catch (e) {
      console.error(`Failed to ${action} event`, e);
    }
  };

  const assignVehicle = async (collectorId: string, vehicleId: string) => {
    const selectedVehicle = vehicles.find((v) => String(v.id) === vehicleId);
    if (!selectedVehicle) return;
    try {
      const payload = {
        ...selectedVehicle,
        assignedDriverId: Number(collectorId),
      };
      const res = await fetch(`${API_BASE}/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        alert('Failed to assign vehicle to collector');
        return;
      }
      setAssignments((prev) => ({ ...prev, [collectorId]: vehicleId }));
      fetchAssignmentData();
    } catch {
      alert('Failed to assign vehicle to collector');
    }
  };

  const displaySchedules = council?.name
    ? schedules.filter((s) => s.council.toLowerCase().includes(String(council.name).toLowerCase()))
    : schedules;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Collection Schedule</h2>
          <p className="text-gray-600">Manage and track waste collection schedules</p>
          {council?.name && <p className="text-sm text-gray-500 mt-1">Showing data for council: {council.name}</p>}
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <Calendar className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {/* Calendar View Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">Today&apos;s Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">2</div>
            <p className="text-sm text-gray-500">83 total bins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">12</div>
            <p className="text-sm text-gray-500">456 total bins</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-600">Active Crews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-gray-900">4</div>
            <p className="text-sm text-gray-500">16 team members</p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule List */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displaySchedules.map((schedule) => (
              <div
                key={schedule.id}
                className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-gray-900 mb-1">{schedule.council}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(schedule.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {schedule.time}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={schedule.status === 'in-progress' ? 'default' : 'secondary'}
                    className={
                      schedule.status === 'in-progress'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }
                  >
                    {schedule.status === 'in-progress' ? 'In Progress' : 'Scheduled'}
                  </Badge>
                </div>

                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{schedule.bins} bins</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{schedule.crew}</span>
                  </div>
                  <div className="px-2 py-1 bg-gray-100 rounded text-gray-700">
                    {schedule.type}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Collector Vehicle Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          {councilFilterUnavailable && (
            <div className="mb-3 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
              Council-specific assignment filtering is not available from backend fields yet, so complete lists are shown.
            </div>
          )}
          {loadingAssignments ? (
            <div className="text-gray-500">Loading collectors and vehicles...</div>
          ) : collectors.length === 0 ? (
            <div className="text-gray-500">No bin collectors found.</div>
          ) : (
            <div className="space-y-3">
              {collectors.map((collector) => (
                <div key={collector.empId} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between gap-4">
                  <div>
                    <p className="text-gray-900">{collector.empName || collector.email}</p>
                    <p className="text-xs text-gray-500">{collector.email}</p>
                  </div>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={assignments[String(collector.empId)] || ''}
                    onChange={(e) => assignVehicle(String(collector.empId), e.target.value)}
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={String(vehicle.id)}>
                        {vehicle.vehicleCode} ({vehicle.licensePlate})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Citizen Event Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSuggestions ? (
            <div className="text-gray-500">Loading suggestions...</div>
          ) : eventSuggestions.length === 0 ? (
            <div className="text-gray-500">No pending event suggestions for your council.</div>
          ) : (
            <div className="space-y-4">
              {eventSuggestions.map((event) => (
                <div key={event.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-gray-900">{event.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {event.location || 'No location'} • {event.eventDate || 'No date'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                      Pending
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateSuggestion(event.id, 'approve')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateSuggestion(event.id, 'reject')}>
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
