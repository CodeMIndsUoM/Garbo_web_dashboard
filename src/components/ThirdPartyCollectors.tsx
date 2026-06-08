'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

interface PendingRegistration {
  empId?: number;
  empName?: string;
  email?: string;
  phone?: string;
  NIC?: string;
  company?: string;
  defaultAddress?: string;
  assignedCouncils?: string;
  nicPhotoUrl?: string;
  nicPhotoBackUrl?: string;
  registrationStatus?: string;
}

interface ApprovedCollector {
  empId?: number;
  empName?: string;
  email?: string;
  registrationStatus?: string;
}

export function ThirdPartyCollectors({ council }: { council?: { name?: string } | null }) {
  const [pending, setPending] = useState<PendingRegistration[]>([]);
  const [approved, setApproved] = useState<ApprovedCollector[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReasons, setRejectReasons] = useState<Record<number, string>>({});

  const tokenHeader = (): Record<string, string> => {
    const token = sessionStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [pendingRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/api/admins/thirdparty-registrations/pending`, { headers: tokenHeader() }),
        fetch(`${API_BASE}/api/users`, { headers: tokenHeader() }),
      ]);
      const pendingJson = await pendingRes.json().catch(() => ({ data: [] }));
      const usersJson = await usersRes.json().catch(() => ({ data: [] }));
      setPending(Array.isArray(pendingJson?.data) ? pendingJson.data : []);
      const all = Array.isArray(usersJson?.data) ? usersJson.data : [];
      setApproved(
        all.filter(
          (u: ApprovedCollector & { role?: string; registrationStatus?: string }) =>
            (u?.role || '').toString().toUpperCase().includes('THIRD') &&
            (u?.registrationStatus || '').toString().toUpperCase() === 'APPROVED'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [council?.name]);

  const approve = async (empId: number) => {
    await fetch(`${API_BASE}/api/admins/thirdparty-registrations/${empId}/approve`, {
      method: 'POST',
      headers: tokenHeader(),
    });
    loadData();
  };

  const reject = async (empId: number) => {
    const reason = rejectReasons[empId] || 'Rejected by admin';
    await fetch(`${API_BASE}/api/admins/thirdparty-registrations/${empId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tokenHeader() },
      body: JSON.stringify({ reason }),
    });
    loadData();
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-gray-900 mb-2">3rd Party Collectors</h2>
        <p className="text-gray-600">Review pending registrations and manage approved collectors</p>
        {council?.name && (
          <p className="text-sm text-gray-500 mt-1">Showing data for council: {council.name}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Registrations</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-500">Loading registrations...</div>
          ) : pending.length === 0 ? (
            <div className="text-gray-500">No pending registrations.</div>
          ) : (
            <div className="space-y-4">
              {pending.map((item) => {
                const id = item.empId ?? 0;
                return (
                  <div key={id} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-gray-900 font-medium">{item.empName || item.email}</p>
                        <p className="text-sm text-gray-600">{item.email}</p>
                        <p className="text-sm text-gray-600">Phone: {item.phone || '-'}</p>
                        <p className="text-sm text-gray-600">NIC: {item.NIC || '-'}</p>
                        <p className="text-sm text-gray-600">Company: {item.company || '-'}</p>
                        <p className="text-sm text-gray-600">Councils: {item.assignedCouncils || '-'}</p>
                        <Badge variant="secondary" className="mt-2 bg-orange-100 text-orange-700">
                          {item.registrationStatus || 'PENDING'}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-2 min-w-[120px]">
                        {item.nicPhotoUrl && (
                          <a href={item.nicPhotoUrl} target="_blank" rel="noreferrer" className="text-xs text-green-700 underline">
                            View NIC (front)
                          </a>
                        )}
                        {item.nicPhotoBackUrl && (
                          <a href={item.nicPhotoBackUrl} target="_blank" rel="noreferrer" className="text-xs text-green-700 underline">
                            View NIC (back)
                          </a>
                        )}
                      </div>
                    </div>
                    <Textarea
                      placeholder="Rejection reason (optional)"
                      value={rejectReasons[id] || ''}
                      onChange={(e) => setRejectReasons((p) => ({ ...p, [id]: e.target.value }))}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approve(id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reject(id)}>
                        Reject
                      </Button>
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
          <CardTitle>Approved Collectors</CardTitle>
        </CardHeader>
        <CardContent>
          {approved.length === 0 ? (
            <div className="text-gray-500">No approved collectors yet.</div>
          ) : (
            <div className="space-y-3">
              {approved.map((collector) => (
                <div key={collector.empId} className="p-3 border border-gray-200 rounded-lg">
                  <p className="text-gray-900">{collector.empName || collector.email}</p>
                  <p className="text-xs text-gray-500">{collector.email}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
