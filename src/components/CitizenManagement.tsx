'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

interface ComplaintItem {
  id: number;
  title?: string;
  description?: string;
  status?: string;
  issueType?: string;
  urgency?: string;
  wasteType?: string;
  location?: string;
  council?: string;
  createdAt?: string;
  resolutionNotes?: string;
}

interface EventItem {
  id: number;
  title?: string;
  description?: string;
}

function statusBadgeClass(status?: string) {
  const normalized = (status || 'PENDING').toUpperCase();
  if (normalized === 'APPROVED' || normalized === 'ACCEPTED') {
    return 'bg-green-100 text-green-800';
  }
  if (normalized === 'REJECTED') {
    return 'bg-red-100 text-red-800';
  }
  if (normalized === 'IN_PROGRESS') {
    return 'bg-blue-100 text-blue-800';
  }
  return 'bg-amber-100 text-amber-800';
}

function isPending(status?: string) {
  const normalized = (status || 'PENDING').toUpperCase();
  return normalized === 'PENDING';
}

export function CitizenManagement({ council }: { council?: { name?: string } | null }) {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tokenHeader = (): Record<string, string> => {
    const token = sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [complaintsRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/complaints`, { headers: tokenHeader() }),
        fetch(`${API_BASE}/api/events/suggestions`, { headers: tokenHeader() }),
      ]);

      if (!complaintsRes.ok) {
        const body = await complaintsRes.json().catch(() => ({}));
        throw new Error(body.message || `Failed to load complaints (${complaintsRes.status})`);
      }

      const complaintsJson = await complaintsRes.json().catch(() => []);
      const eventsJson = await eventsRes.json().catch(() => []);
      setComplaints(Array.isArray(complaintsJson) ? complaintsJson : []);
      setEvents(Array.isArray(eventsJson) ? eventsJson : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load citizen data');
      setComplaints([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateComplaint = async (id: number, status: 'APPROVED' | 'REJECTED') => {
    setActionId(id);
    setError(null);

    let resolutionNotes: string | undefined;
    if (status === 'REJECTED') {
      const reason = window.prompt('Rejection reason (optional):');
      if (reason === null) {
        setActionId(null);
        return;
      }
      resolutionNotes = reason.trim() || undefined;
    }

    try {
      const response = await fetch(`${API_BASE}/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tokenHeader() },
        body: JSON.stringify({ status, resolutionNotes }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.message || `Failed to update complaint (${response.status})`);
      }

      setComplaints((current) =>
        current.map((complaint) =>
          complaint.id === id
            ? {
                ...complaint,
                status: body.status || status,
                resolutionNotes: body.resolutionNotes ?? complaint.resolutionNotes,
              }
            : complaint,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update complaint');
    } finally {
      setActionId(null);
    }
  };

  const updateEvent = async (id: number, action: 'approve' | 'reject') => {
    setActionId(id);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/events/${id}/${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...tokenHeader() },
        body: action === 'reject' ? JSON.stringify({ reason: 'Rejected by admin' }) : undefined,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Failed to update event (${response.status})`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-gray-900 mb-2">Citizen Management</h2>
        <p className="text-gray-600">Review citizen complaints and event submissions</p>
        {council?.name && (
          <p className="text-sm text-gray-500 mt-1">Showing data for council: {council.name}</p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Citizen Complaints</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-500">Loading complaints...</div>
          ) : complaints.length === 0 ? (
            <div className="text-gray-500">No complaints found.</div>
          ) : (
            <div className="space-y-3">
              {complaints.map((complaint) => (
                <div
                  key={complaint.id}
                  className="p-4 border border-gray-200 rounded-lg flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-gray-900 font-medium">
                        {complaint.title || `Complaint #${complaint.id}`}
                      </p>
                      <Badge className={statusBadgeClass(complaint.status)}>
                        {complaint.status || 'PENDING'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {complaint.description || 'No description'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {complaint.issueType && <span>Issue: {complaint.issueType}</span>}
                      {complaint.urgency && <span>Urgency: {complaint.urgency}</span>}
                      {complaint.location && <span>Location: {complaint.location}</span>}
                      {complaint.createdAt && (
                        <span>Submitted: {complaint.createdAt.split('T')[0]}</span>
                      )}
                    </div>
                    {complaint.resolutionNotes && (
                      <p className="text-xs text-gray-500 mt-2">
                        Admin note: {complaint.resolutionNotes}
                      </p>
                    )}
                  </div>
                  {isPending(complaint.status) ? (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={actionId === complaint.id}
                        onClick={() => updateComplaint(complaint.id, 'APPROVED')}
                      >
                        {actionId === complaint.id ? 'Saving...' : 'Approve'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === complaint.id}
                        onClick={() => updateComplaint(complaint.id, 'REJECTED')}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 shrink-0">Reviewed</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Citizen Event Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-500">Loading event suggestions...</div>
          ) : events.length === 0 ? (
            <div className="text-gray-500">No pending event suggestions.</div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="p-4 border border-gray-200 rounded-lg flex items-start justify-between gap-4"
                >
                  <div>
                    <p className="text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{event.description || 'No description'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={actionId === event.id}
                      onClick={() => updateEvent(event.id, 'approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionId === event.id}
                      onClick={() => updateEvent(event.id, 'reject')}
                    >
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
