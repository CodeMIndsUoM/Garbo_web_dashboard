'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { isSuperadmin } from '@/lib/auth';
import type { ApiListResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface InternalUser {
  empId: number;
  empName?: string;
  email?: string;
  role?: string;
  onDuty?: boolean;
}

interface GamificationTask {
  id: number;
  code?: string;
  title?: string;
  description?: string;
  status?: string;
}

export function InternalUsers({ council }: { council?: { id?: string; name?: string } | null }) {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  // Use `council` prop from parent for superadmin selection; do not maintain local council state here.

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [role, setRole] = useState<'FIELD_MENTOR' | 'BIN_COLLECTOR'>('FIELD_MENTOR');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setListLoading(true);
    setListError('');
    try {
      let path = '/api/admins/staff';
      const councilName = council?.name;
      if (isSuperadmin() && councilName) {
        path += `?council=${encodeURIComponent(councilName)}`;
      }
      const { response, data } = await apiFetch<ApiListResponse<InternalUser[]>>(path);
      if (response.status === 403) {
        setListError('You do not have permission to view internal staff');
        setUsers([]);
        return;
      }
      if (!response.ok) {
        setListError(data?.message || 'Failed to load internal staff');
        setUsers([]);
      } else {
        setUsers(Array.isArray(data?.data) ? data.data : []);
      }
    } catch {
      setListError('Network error');
      setUsers([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [council?.id]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setContactNumber('');
    setRole('FIELD_MENTOR');
    setError('');
    setSuccess('');
  };

  const deleteUser = async (id: string | number) => {
    if (!confirm('Delete this internal user? This action cannot be undone.')) return;
    setListError('');
    try {
      const { response, data } = await apiFetch<ApiListResponse<unknown>>(
        `/api/admins/staff/${id}`,
        { method: 'DELETE' }
      );
      if (response.status === 403) {
        setListError('Not allowed');
        return;
      }
      if (response.status === 404) {
        setListError('User not found');
        await loadData();
        return;
      }
      if (response.status === 409) {
        setListError('Cannot delete due to constraints');
        return;
      }
      if (!response.ok) {
        setListError(data?.message || 'Failed to delete internal user');
        return;
      }
      // success
      await loadData();
    } catch (err: any) {
      setListError('Network error while deleting user');
    }
  };

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim(),
        contactNumber: contactNumber.trim() || undefined,
      };

      const path =
        role === 'FIELD_MENTOR'
          ? '/api/admins/staff/field-mentors'
          : '/api/admins/staff/bin-collectors';

      const { response, data } = await apiFetch<ApiListResponse<unknown>>(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(data?.message || 'Failed to create internal user');
      } else if (data.success) {
        setSuccess('Internal user created successfully!');
        resetForm();
        await loadData();
      } else {
        setError(data?.message || 'Failed to create internal user');
      }
    } catch (err: any) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-gray-900 mb-2">Internal Users</h2>
        <p className="text-gray-600">Create and view internal staff (field mentors and bin collectors).</p>
        {council?.name && <p className="text-sm text-gray-500 mt-1">Showing data for council: {council.name}</p>}
        {/* Council selection is managed at a higher-level (app/page.tsx) and passed via the `council` prop. */}
      </div>

      {!isSuperadmin() && (
      <Card>
        <CardHeader>
          <CardTitle>Create Internal User</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end" onSubmit={createUser}>
            <div>
              <label className="block mb-1 font-medium">Full Name</label>
              <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="block mb-1 font-medium">Email</label>
              <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block mb-1 font-medium">Contact Number</label>
              <Input placeholder="0771234567" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
            </div>
            <div>
              <label className="block mb-1 font-medium">Role</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as 'FIELD_MENTOR' | 'BIN_COLLECTOR')}
              >
                <option value="FIELD_MENTOR">FIELD_MENTOR</option>
                <option value="BIN_COLLECTOR">BIN_COLLECTOR</option>
              </select>
            </div>

            <div className="md:col-span-4 flex items-center gap-3 mt-2">
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>{loading ? 'Creating...' : 'Create Internal User'}</Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>Reset</Button>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {success && <div className="text-green-600 text-sm">{success}</div>}
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Internal Users</CardTitle>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="text-gray-500">Loading users...</div>
          ) : listError ? (
            <div className="text-red-600">{listError}</div>
          ) : users.length === 0 ? (
            <div className="text-gray-500">No internal users found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-lg font-semibold">Employee ID</TableHead>
                      <TableHead className="text-lg font-semibold">Full Name</TableHead>
                      <TableHead className="text-lg font-semibold">Email</TableHead>
                      <TableHead className="text-lg font-semibold">Role</TableHead>
                      <TableHead className="text-lg font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user: any) => (
                      <TableRow key={user.empId ?? user.id ?? user.userId}>
                        <TableCell className="font-medium align-middle">{user.empId ?? user.id ?? user.userId ?? '-'}</TableCell>
                        <TableCell className="align-middle">{user.empName ?? user.fullName ?? user.username ?? '-'}</TableCell>
                        <TableCell className="align-middle">{user.email ?? '-'}</TableCell>
                        <TableCell className="align-middle">{(user.role || '-').toString()}</TableCell>
                        <TableCell className="align-middle">
                          {isSuperadmin() ? (
                            '—'
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => deleteUser(user.empId ?? user.id ?? user.userId)}>
                              Delete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
