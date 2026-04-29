'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

interface CollectorUser {
  empId?: number;
  id?: number;
  empName?: string;
  email?: string;
  role?: string;
  council?: string;
}

export function ThirdPartyCollectors({ council }: { council?: { name?: string } | null }) {
  const [collectors, setCollectors] = useState<CollectorUser[]>([]);
  const [analytics, setAnalytics] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ empName: '', email: '', password: '' });
  const [councilFilterUnavailable, setCouncilFilterUnavailable] = useState(false);

  const tokenHeader = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`, { headers: tokenHeader() }),
        fetch(`${API_BASE}/api/admin/thirdparty/analyze`, { headers: tokenHeader() }),
      ]);
      const usersJson = await usersRes.json().catch(() => ({ data: [] }));
      const logsJson = await logsRes.json().catch(() => null);
      const onlyThirdParty = Array.isArray(usersJson?.data)
        ? usersJson.data.filter((u: CollectorUser) => (u?.role || '').toString().toUpperCase().includes('THIRD'))
        : [];
      const councilName = (council?.name || '').toLowerCase();
      const hasCouncilField = onlyThirdParty.some((u: CollectorUser) => typeof u.council === 'string');
      setCouncilFilterUnavailable(Boolean(councilName) && !hasCouncilField && onlyThirdParty.length > 0);
      const scoped = councilName
        ? onlyThirdParty.filter((u: CollectorUser) => (typeof u.council !== 'string' ? true : u.council.toLowerCase() === councilName))
        : onlyThirdParty;
      setCollectors(scoped);
      setAnalytics(logsJson);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createCollector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.empName || !form.email || !form.password) return;
    await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tokenHeader() },
      body: JSON.stringify({
        empName: form.empName,
        email: form.email,
        password: form.password,
        role: 'THIRD_PARTY_COLLECTOR',
      }),
    });
    setForm({ empName: '', email: '', password: '' });
    loadData();
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-gray-900 mb-2">3rd Party Collectors</h2>
        <p className="text-gray-600">Manage third-party collectors and view analytics logs</p>
        {council?.name && <p className="text-sm text-gray-500 mt-1">Showing data for council: {council.name}</p>}
      </div>
      {councilFilterUnavailable && (
        <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
          Council-specific filtering is not available from backend fields yet, so the complete list is shown here.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add Collector</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3" onSubmit={createCollector}>
            <Input placeholder="Name" value={form.empName} onChange={(e) => setForm((p) => ({ ...p, empName: e.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            <Button type="submit" className="bg-green-600 hover:bg-green-700">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collectors</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-500">Loading collectors...</div>
          ) : collectors.length === 0 ? (
            <div className="text-gray-500">No third-party collectors found.</div>
          ) : (
            <div className="space-y-3">
              {collectors.map((collector) => (
                <div key={collector.empId || collector.id} className="p-3 border border-gray-200 rounded-lg">
                  <p className="text-gray-900">{collector.empName || collector.email}</p>
                  <p className="text-xs text-gray-500">{collector.email}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Third-Party Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-gray-50 border border-gray-200 p-3 rounded-lg overflow-auto">
            {JSON.stringify(analytics, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
