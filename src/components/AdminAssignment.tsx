'use client';

import { useState, useEffect } from 'react';
import { LogOut, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { PageHeader } from './layout/PageHeader';
import { typography } from '@/theme';

interface User {
  empId?: number | string;
  id?: number | string;
  empName?: string | null;
  username?: string | null;
  role?: string | null;
  email?: string;
  createdAt?: string;
  council?: string | null;
}

function adminRowKey(user: User, index: number): string {
  const id = user.empId ?? user.id;
  if (id !== undefined && id !== null && id !== '') {
    return String(id);
  }
  if (user.email) {
    return `email-${user.email}`;
  }
  return `admin-row-${index}`;
}

interface AdminAssignmentProps {
  onAddNewAdmin?: () => void;
  onLogout?: () => void;
}

export function AdminAssignment({ onAddNewAdmin, onLogout }: AdminAssignmentProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || 'Failed to fetch users');
        setUsers([]);
      } else if (json.success && json.data) {
        setUsers(json.data);
      } else {
        setUsers([]);
      }
    } catch {
      setError('Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => (u.role || '') === 'ADMIN');

  const displayName = (user: User) =>
    user.empName || user.username || user.email || 'N/A';

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-8">
      <PageHeader
        title="Admin Management"
        subtitle="Assign and manage admins across all councils"
        actions={
          <>
            <Button
              type="button"
              variant="brand"
              className="gap-2"
              onClick={() => onAddNewAdmin?.()}
            >
              <UserPlus className="size-4" />
              Add New Admin
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-status-danger-border text-status-danger hover:bg-status-danger-muted"
              onClick={() => onLogout?.()}
            >
              <LogOut className="size-4" />
              Log Out
            </Button>
          </>
        }
      />

      <Card className="border-border bg-card shadow-[var(--shadow-card)]">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className={typography.sectionTitle}>All Admins</CardTitle>
          <p className={typography.caption}>
            {loading
              ? 'Loading admin accounts…'
              : `${filteredUsers.length} admin${filteredUsers.length === 1 ? '' : 's'} registered`}
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-status-danger-border bg-status-danger-muted px-4 py-3 text-sm text-status-danger">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className={`py-12 text-center ${typography.bodyMuted}`}>Loading users…</div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className={typography.body}>No admins found</p>
              <p className={typography.caption}>
                Create a new admin account to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className={`min-w-[180px] ${typography.label}`}>Full Name</TableHead>
                    <TableHead className={`min-w-[220px] ${typography.label}`}>Email</TableHead>
                    <TableHead className={`min-w-[160px] ${typography.label}`}>Council</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user, index) => (
                    <TableRow key={adminRowKey(user, index)}>
                      <TableCell className={`align-middle ${typography.rowTitle}`}>
                        {displayName(user)}
                      </TableCell>
                      <TableCell className={`align-middle ${typography.bodyMuted}`}>
                        {user.email || 'N/A'}
                      </TableCell>
                      <TableCell className={`align-middle ${typography.bodyMuted}`}>
                        {user.council || '—'}
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
