'use client';

import { useState, useEffect } from 'react';
import { Users, Shield, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
// Removed search input import per UI refactor
import { Badge } from './ui/badge';
// Modal-based admin creation removed — keep file focused on listing and role management

interface User {
  id: string;
  empName?: string | null;
  username?: string | null; // legacy
  role?: string | null; // backend uses SUPERADMIN, ADMIN, CITIZEN/USER
  email?: string;
  createdAt?: string;
  council?: string | null; // backend does not provide; show '-' when absent
}

interface AdminAssignmentProps {
  onAddNewAdmin?: () => void;
}

export function AdminAssignment({ onAddNewAdmin }: AdminAssignmentProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  // Modal creation flow removed; creation should be done via CreateAdminPage

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      // Include token/Authorization header for GET
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      // log raw API response for verification
      console.log('RAW USERS:', json);
      if (!res.ok) {
        setError(json?.message || 'Failed to fetch users');
        setUsers([]);
      } else if (json.success && json.data) {
        setUsers(json.data);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      setError('Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Admin creation should be handled by `CreateAdminPage` — modal creation disabled

  // Assign admin removed per spec (no client-side assign feature)

  const removeAdmin = async (userId: string) => {
    setUpdatingUser(userId);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: 'user' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || 'Failed to remove admin role');
      }
      // Always re-fetch users to ensure UI is in sync
      await fetchUsers();
    } catch (err: any) {
      setError('Failed to remove admin: ' + (err?.message || err));
    } finally {
      setUpdatingUser(null);
    }
  };

  const filteredUsers = users; // All users are source of truth

  const stats = {
    total: users.length,
    superadmins: users.filter((u) => ((u.role || '').toString().toUpperCase() === 'SUPERADMIN')).length,
    admins: users.filter((u) => ((u.role || '').toString().toUpperCase() === 'ADMIN')).length,
    regular: users.filter((u) => {
      const r = (u.role || '').toString().toUpperCase();
      return r !== 'SUPERADMIN' && r !== 'ADMIN';
    }).length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-gray-900 mb-2 text-2xl font-semibold">Assign Admins</h2>
        <p className="text-gray-600">Manage user roles and assign admin privileges</p>
      </div>

      {/* Stats (temporarily hidden)
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Users</p>
                <p className="text-2xl text-gray-900">{stats.total}</p>
              </div>
              <Users className="w-10 h-10 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Superadmins</p>
                <p className="text-2xl text-purple-600">{stats.superadmins}</p>
              </div>
              <Shield className="w-10 h-10 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Admins</p>
                <p className="text-2xl text-blue-600">{stats.admins}</p>
              </div>
              <Shield className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Regular Users</p>
                <p className="text-2xl text-green-600">{stats.regular}</p>
              </div>
              <Users className="w-10 h-10 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>
      */}


      {/* Add Admin Button and Search */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          className="flex items-center gap-2"
          onClick={() => { if (onAddNewAdmin) onAddNewAdmin(); }}
        >
          <UserPlus className="w-4 h-4" />
          Add New Admin
        </Button>
      </div>

      {/* Admin creation moved to CreateAdminPage; modal removed */}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Username</TableHead>
                    <TableHead className="min-w-[220px]">Email</TableHead>
                    <TableHead className="min-w-[140px]">Current Role</TableHead>
                    <TableHead className="min-w-[160px]">Council</TableHead>
                    <TableHead className="min-w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium align-middle">
                        {user.empName ? user.empName : (user.username ? user.username : (user.email || 'N/A'))}
                      </TableCell>
                      <TableCell className="align-middle">{user.email || 'N/A'}</TableCell>
                      <TableCell className="align-middle">
                        {(() => {
                          const role = (user.role || '').toString();
                          if (role === 'SUPERADMIN') {
                            return <Badge variant="secondary" className="bg-purple-100 text-purple-700">Super Admin</Badge>;
                          }
                          if (role === 'ADMIN') {
                            return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Admin</Badge>;
                          }
                          return <Badge variant="secondary" className="bg-gray-100 text-gray-700">User</Badge>;
                        })()}
                      </TableCell>
                      <TableCell className="align-middle">{user.council ? user.council : '-'}</TableCell>
                      <TableCell className="align-middle">
                        {((user.role || '').toString() === 'SUPERADMIN') ? (
                          <span className="text-sm text-gray-500 whitespace-nowrap">Cannot modify</span>
                        ) : ((user.role || '').toString() === 'ADMIN') ? (
                          <Button
                            onClick={() => removeAdmin(user.id)}
                            disabled={updatingUser === user.id}
                            size="sm"
                            variant="destructive"
                            className="w-32"
                          >
                            {updatingUser === user.id ? 'Removing...' : 'Remove Admin'}
                          </Button>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
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
      {/* Bottom submit button removed per UI refactor */}
    </div>
  );
}
