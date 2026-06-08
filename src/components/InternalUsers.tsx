'use client';

import { useEffect, useMemo, useState } from 'react';
import { EyeOff, HardHat, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { isSuperadmin } from '@/lib/auth';
import { COUNCILS } from '@/lib/council-context';
import type { ApiListResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

type InternalSection = 'field-staff' | 'bin-collectors';
type StaffRole = 'FIELD_MENTOR' | 'BIN_COLLECTOR';

interface InternalUser {
  empId: number;
  empName?: string;
  email?: string;
  role?: string;
  onDuty?: boolean;
}

interface SubSectionItem<T extends string> {
  id: T;
  label: string;
  icon: React.ReactNode;
  count?: number;
  description: string;
}

function SubSectionNav<T extends string>({
  items,
  active,
  onChange,
}: {
  items: SubSectionItem<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  const activeItem = items.find((item) => item.id === active);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${active === item.id
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${active === item.id ? 'bg-white/20 text-white' : 'bg-white text-gray-600'
                  }`}
              >
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>
      {activeItem && <p className="text-sm text-gray-500">{activeItem.description}</p>}
    </div>
  );
}

function normalizeRole(role?: string): string {
  return (role || '').trim().toUpperCase();
}

function isFieldStaff(user: InternalUser): boolean {
  const role = normalizeRole(user.role);
  return role === 'FIELD_MENTOR' || role.includes('MENTOR');
}

function isBinCollector(user: InternalUser): boolean {
  const role = normalizeRole(user.role);
  return role === 'BIN_COLLECTOR';
}

export function InternalUsers({ council }: { council?: { id?: string; name?: string } | null }) {
  const [section, setSection] = useState<InternalSection>('field-staff');
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const superadmin = isSuperadmin();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [createCouncil, setCreateCouncil] = useState(council?.name || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeRole: StaffRole = section === 'field-staff' ? 'FIELD_MENTOR' : 'BIN_COLLECTOR';

  const fieldStaff = useMemo(() => users.filter(isFieldStaff), [users]);
  const binCollectors = useMemo(() => users.filter(isBinCollector), [users]);
  const sectionUsers = section === 'field-staff' ? fieldStaff : binCollectors;

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
    void loadData();
  }, [council?.id]);

  useEffect(() => {
    if (council?.name) {
      setCreateCouncil(council.name);
    }
  }, [council?.name]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setContactNumber('');
    setError('');
    setSuccess('');
  };

  const hideUser = async (id: string | number) => {
    if (!confirm('Hide this user from the admin list?')) return;
    setListError('');
    try {
      const { response, data } = await apiFetch<ApiListResponse<unknown>>(
        `/api/admins/staff/${id}/hide`,
        { method: 'POST' }
      );
      if (response.status === 403) {
        toast.error('Not allowed to hide this user');
        return;
      }
      if (!response.ok) {
        toast.error(data?.message || 'Failed to hide user');
        return;
      }
      toast.success('User hidden');
      void loadData();
    } catch {
      toast.error('Network error while hiding user');
    }
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
        toast.error('Not allowed to delete this user');
        return;
      }
      if (response.status === 404) {
        toast.error('User not found');
        void loadData();
        return;
      }
      if (response.status === 409) {
        toast.error('Cannot delete due to linked records');
        return;
      }
      if (!response.ok) {
        toast.error(data?.message || 'Failed to delete internal user');
        return;
      }
      toast.success('User deleted');
      void loadData();
    } catch {
      toast.error('Network error while deleting user');
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
    if (superadmin && !createCouncil.trim()) {
      setError('Please select a council');
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string | undefined> = {
        fullName: fullName.trim(),
        email: email.trim(),
        contactNumber: contactNumber.trim() || undefined,
      };
      if (superadmin) {
        payload.council = createCouncil.trim();
      }

      const path =
        activeRole === 'FIELD_MENTOR'
          ? '/api/admins/staff/field-mentors'
          : '/api/admins/staff/bin-collectors';

      const { response, data } = await apiFetch<ApiListResponse<unknown>>(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setError(data?.message || 'Failed to create internal user');
      } else if (data.success) {
        setSuccess(`User created. Temporary password sent to ${email.trim()}.`);
        resetForm();
        if (council?.name) {
          setCreateCouncil(council.name);
        }
        void loadData();
      } else {
        setError(data?.message || 'Failed to create internal user');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const internalSections: SubSectionItem<InternalSection>[] = [
    {
      id: 'field-staff',
      label: 'Field Staff',
      icon: <HardHat className="w-4 h-4" />,
      count: fieldStaff.length,
      description: 'Field mentors who supervise collection operations.',
    },
    {
      id: 'bin-collectors',
      label: 'Bin Collectors',
      icon: <Trash2 className="w-4 h-4" />,
      count: binCollectors.length,
      description: 'Bin collectors assigned to council routes.',
    },
  ];

  const sectionTitle = section === 'field-staff' ? 'Field Staff' : 'Bin Collectors';
  const createLabel = section === 'field-staff' ? 'Create Field Staff' : 'Create Bin Collector';

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-gray-900 mb-2">Internal Users</h2>
        <p className="text-gray-600">Manage field staff and bin collectors for your council.</p>
        {council?.name && (
          <p className="text-sm text-gray-500 mt-1">Council context: {council.name}</p>
        )}
      </div>

      <SubSectionNav items={internalSections} active={section} onChange={setSection} />

      <Card>
        <CardHeader>
          <CardTitle>{createLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end" onSubmit={createUser}>
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
            {superadmin && (
              <div>
                <label className="block mb-1 font-medium">Council</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={createCouncil}
                  onChange={(e) => setCreateCouncil(e.target.value)}
                  required
                >
                  <option value="">Select council</option>
                  {COUNCILS.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="lg:col-span-3 flex items-center gap-3 mt-2 flex-wrap">
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={loading}>
                {loading ? 'Creating...' : createLabel}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                Reset
              </Button>
              <Badge variant="secondary">{activeRole}</Badge>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {success && <div className="text-green-600 text-sm">{success}</div>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            {sectionTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="text-gray-500">Loading users...</div>
          ) : listError ? (
            <div className="text-red-600">{listError}</div>
          ) : sectionUsers.length === 0 ? (
            <div className="text-gray-500">No {sectionTitle.toLowerCase()} found for this council.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>On Duty</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectionUsers.map((user) => (
                    <TableRow key={user.empId}>
                      <TableCell className="font-medium">{user.empId}</TableCell>
                      <TableCell>{user.empName || '-'}</TableCell>
                      <TableCell>{user.email || '-'}</TableCell>
                      <TableCell>
                        <Badge className={user.onDuty ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}>
                          {user.onDuty ? 'On duty' : 'Off duty'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => void hideUser(user.empId)}>
                            <EyeOff className="w-3.5 h-3.5 mr-1" />
                            Hide
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void deleteUser(user.empId)}>
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
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
