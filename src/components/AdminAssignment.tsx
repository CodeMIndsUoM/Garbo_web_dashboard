import { useState, useEffect } from 'react';
import { Users, Shield, UserPlus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from './ui/dialog';
import { Label } from './ui/label';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'superadmin' | 'user';
  email?: string;
  createdAt?: string;
  council?: string;
}

export function AdminAssignment() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8080';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      // Remove token/Authorization header for GET if not required by backend
      const res = await fetch(`${API_BASE}/api/users`);
      const json = await res.json();
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

  const createAdmin = async () => {
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setError('Please enter username, email, and password');
      return;
    }

    setIsCreating(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      // Only send fields the backend expects: email, password, role
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPassword.trim(),
          role: 'admin',
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json?.message || `Failed to create admin (status ${res.status})`);
      } else if (json.success) {
        const newUser = json.data;
        setUsers((prev) => [...prev, newUser]);
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setIsDialogOpen(false);
      }
    } catch (err: any) {
      setError('Failed to create admin: ' + (err?.message || err));
    } finally {
      setIsCreating(false);
    }
  };

  const assignAdmin = async (userId: string) => {
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
        body: JSON.stringify({ role: 'admin' }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || 'Failed to assign admin role');
      }
      // Always re-fetch users to ensure UI is in sync
      await fetchUsers();
    } catch (err: any) {
      setError('Failed to assign admin: ' + (err?.message || err));
    } finally {
      setUpdatingUser(null);
    }
  };

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

  const filteredUsers = users.filter((user) =>
    (user.username?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: users.length,
    superadmins: users.filter((u) => u.role === 'superadmin').length,
    admins: users.filter((u) => u.role === 'admin').length,
    regular: users.filter((u) => u.role === 'user').length,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-gray-900 mb-2 text-2xl font-semibold">Assign Admins</h2>
        <p className="text-gray-600">Manage user roles and assign admin privileges</p>
      </div>

      {/* Stats */}
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


      {/* Add Admin Button and Search */}
      <div className="mb-6 flex items-center gap-4">
        <Button className="flex items-center gap-2" onClick={() => setIsDialogOpen(true)}>
          <UserPlus className="w-4 h-4" />
          Add New Admin
        </Button>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search users by username or email..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Admin Creation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Admin</DialogTitle>
            <DialogDescription>Fill in the details to create a new admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Username</Label>
            <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="Username" />
            <Label>Email</Label>
            <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" />
            <Label>Password</Label>
            <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password" type="password" />
            {error && <div className="text-red-600 text-sm">{error}</div>}
          </div>
          <DialogFooter>
            <Button onClick={createAdmin} {...(isCreating ? { loading: true } : {})} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Admin'}
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          ) : filteredUsers.length === 0 ? (
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
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium align-middle">{user.username}</TableCell>
                      <TableCell className="align-middle">{user.email || 'N/A'}</TableCell>
                      <TableCell className="align-middle">
                        <Badge
                          variant="secondary"
                          className={
                            user.role === 'superadmin'
                              ? 'bg-purple-100 text-purple-700'
                              : user.role === 'admin'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }
                        >
                          {user.role === 'superadmin' ? 'superadmin' : user.role === 'admin' ? 'admin' : 'Regular User'}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-middle">{user.council || '—'}</TableCell>
                      <TableCell className="align-middle">
                        {user.role === 'superadmin' ? (
                          <span className="text-sm text-gray-500 whitespace-nowrap">Cannot modify</span>
                        ) : user.role === 'admin' ? (
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
                          <Button
                            onClick={() => assignAdmin(user.id)}
                            disabled={updatingUser === user.id}
                            size="sm"
                            variant="default"
                            className="w-32"
                          >
                            {updatingUser === user.id ? 'Assigning...' : 'Assign Admin'}
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
      {/* Submit Button at the bottom of the page */}
      <div className="flex justify-end mt-8">
        <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded">
          Submit
        </Button>
      </div>
    </div>
  );
}
