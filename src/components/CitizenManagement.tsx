'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface ComplaintItem {
  id: number;
  title?: string;
  description?: string;
  status?: string;
}

interface EventItem {
  id: number;
  title?: string;
  description?: string;
}

export function CitizenManagement({ council }: { council?: { name?: string } | null }) {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const tokenHeader = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [complaintsRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE}/api/complaints`, { headers: tokenHeader() }),
        fetch(`${API_BASE}/api/events/suggestions`, { headers: tokenHeader() }),
      ]);
      const complaintsJson = await complaintsRes.json().catch(() => []);
      const eventsJson = await eventsRes.json().catch(() => []);
      setComplaints(Array.isArray(complaintsJson) ? complaintsJson : []);
      setEvents(Array.isArray(eventsJson) ? eventsJson : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateComplaint = async (id: number, status: string) => {
    await fetch(`${API_BASE}/api/complaints/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...tokenHeader() },
      body: JSON.stringify({ status }),
    });
    loadData();
  };

  const updateEvent = async (id: number, action: 'approve' | 'reject') => {
    await fetch(`${API_BASE}/api/events/${id}/${action}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...tokenHeader() },
      body: action === 'reject' ? JSON.stringify({ reason: 'Rejected by admin' }) : undefined,
    });
    loadData();
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
                <div key={complaint.id} className="p-4 border border-gray-200 rounded-lg flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gray-900">{complaint.title || `Complaint #${complaint.id}`}</p>
                    <p className="text-sm text-gray-600 mt-1">{complaint.description || 'No description'}</p>
                    <Badge variant="secondary" className="mt-2">{complaint.status || 'PENDING'}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateComplaint(complaint.id, 'APPROVED')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateComplaint(complaint.id, 'REJECTED')}>
                      Reject
                    </Button>
                  </div>
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
                <div key={event.id} className="p-4 border border-gray-200 rounded-lg flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gray-900">{event.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{event.description || 'No description'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateEvent(event.id, 'approve')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateEvent(event.id, 'reject')}>
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
