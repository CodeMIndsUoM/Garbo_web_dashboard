'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface InternalUser {
  empId: number;
  empName?: string;
  email?: string;
  role?: string;
  council?: string;
}

interface GamificationTask {
  id: number;
  code?: string;
  title?: string;
  description?: string;
  status?: string;
}

export function InternalUsers({ council }: { council?: { name?: string } | null }) {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [tasks, setTasks] = useState<GamificationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ empName: '', email: '', password: '', role: 'ADMIN' });
  const [councilFilterUnavailable, setCouncilFilterUnavailable] = useState(false);

  const tokenHeader = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE}/api/users`, { headers: tokenHeader() }),
        fetch(`${API_BASE}/api/admins/gamification/tasks`, { headers: tokenHeader() }),
      ]);
      const usersJson = await usersRes.json().catch(() => ({ data: [] }));
      const tasksJson = await tasksRes.json().catch(() => ({ data: [] }));
      const allUsers: InternalUser[] = Array.isArray(usersJson?.data) ? usersJson.data : [];
      const councilName = (council?.name || '').toLowerCase();
      const hasCouncilField = allUsers.some((u) => typeof u.council === 'string');
      setCouncilFilterUnavailable(Boolean(councilName) && !hasCouncilField && allUsers.length > 0);
      const scopedUsers = councilName
        ? allUsers.filter((u) => (typeof u.council !== 'string' ? true : u.council.toLowerCase() === councilName))
        : allUsers;
      setUsers(scopedUsers);
      setTasks(Array.isArray(tasksJson?.data) ? tasksJson.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...tokenHeader() },
      body: JSON.stringify(form),
    });
    setForm({ empName: '', email: '', password: '', role: 'ADMIN' });
    loadData();
  };

  const deleteUser = async (id: number) => {
    await fetch(`${API_BASE}/api/users/${id}`, { method: 'DELETE', headers: tokenHeader() });
    loadData();
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-gray-900 mb-2">Internal Users</h2>
        <p className="text-gray-600">Manage internal users and active gamification tasks</p>
        {council?.name && <p className="text-sm text-gray-500 mt-1">Showing data for council: {council.name}</p>}
      </div>
      {councilFilterUnavailable && (
        <div className="p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
          Council-specific filtering is not available from backend fields yet, so the complete internal user list is shown.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create Internal User</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={createUser}>
            <Input placeholder="Name" value={form.empName} onChange={(e) => setForm((p) => ({ ...p, empName: e.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <Input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
            <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
              <option value="ADMIN">Admin</option>
              <option value="COLLECTOR">Collector</option>
            </select>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-gray-500">Loading users...</div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.empId} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between gap-3">
                  <div>
                    <p className="text-gray-900">{user.empName || user.email}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{user.role || 'UNKNOWN'}</Badge>
                    <Button size="sm" variant="outline" onClick={() => deleteUser(user.empId)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gamification Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-gray-500">No gamification tasks available.</div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div key={task.id} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-gray-900">{task.title || task.code}</p>
                    <p className="text-xs text-gray-500">{task.description || 'No description'}</p>
                  </div>
                  <Badge variant="secondary">{task.status || 'ACTIVE'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
