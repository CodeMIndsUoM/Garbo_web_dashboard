'use client';

import { useEffect, useMemo, useState } from 'react';
import { HardHat, Trash2, Users } from 'lucide-react';
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
import { PageHeader } from './layout/PageHeader';
import {
  FormActions,
  FormField,
  FormPanel,
  FormSelect,
  PageSubSectionNav,
  TableRowActions,
  type NavItem,
} from './layout/management-ui';

type InternalSection = 'field-staff' | 'bin-collectors';
type StaffRole = 'FIELD_MENTOR' | 'BIN_COLLECTOR';

interface InternalUser {
  empId: number;
  empName?: string;
  email?: string;
  role?: string;
  onDuty?: boolean;
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

  const internalSections: NavItem<InternalSection>[] = [
    {
      id: 'field-staff',
      label: 'Field Staff',
      icon: <HardHat className="size-4" />,
      count: fieldStaff.length,
      description: 'Field mentors who supervise collection operations.',
    },
    {
      id: 'bin-collectors',
      label: 'Bin Collectors',
      icon: <Trash2 className="size-4" />,
      count: binCollectors.length,
      description: 'Bin collectors assigned to council routes.',
    },
  ];

  const sectionTitle = section === 'field-staff' ? 'Field Staff' : 'Bin Collectors';
  const createLabel = section === 'field-staff' ? 'Create Field Staff' : 'Create Bin Collector';

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Internal Users"
        subtitle="Manage field staff and bin collectors for your council."
        extra={council?.name ? `Council context: ${council.name}` : undefined}
      />

      <PageSubSectionNav
        title="Staff type"
        items={internalSections}
        active={section}
        onChange={setSection}
      />

      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{createLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser}>
            <FormPanel>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <FormField label="Full Name" htmlFor="internal-full-name">
                  <Input
                    id="internal-full-name"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Email" htmlFor="internal-email">
                  <Input
                    id="internal-email"
                    placeholder="name@example.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Contact Number" htmlFor="internal-contact">
                  <Input
                    id="internal-contact"
                    placeholder="0771234567"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                  />
                </FormField>
              </div>

              {superadmin ? (
                <div className="mt-5 max-w-md">
                  <FormField label="Council" htmlFor="internal-council">
                    <FormSelect
                      id="internal-council"
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
                    </FormSelect>
                  </FormField>
                </div>
              ) : null}
            </FormPanel>

            <FormActions>
              <Badge variant="outline" className="border-border text-muted-foreground">
                {activeRole}
              </Badge>
              <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
                Reset
              </Button>
              <Button type="submit" variant="brand" disabled={loading}>
                {loading ? 'Creating...' : createLabel}
              </Button>
            </FormActions>
            {error ? (
              <p className="mt-3 text-sm text-status-danger">{error}</p>
            ) : null}
            {success ? (
              <p className="mt-3 text-sm text-status-success">{success}</p>
            ) : null}
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
            <div className="text-muted-foreground">Loading users...</div>
          ) : listError ? (
            <div className="text-red-600">{listError}</div>
          ) : sectionUsers.length === 0 ? (
            <div className="text-muted-foreground">No {sectionTitle.toLowerCase()} found for this council.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>On Duty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectionUsers.map((user) => (
                    <TableRow key={user.empId}>
                      <TableCell className="font-medium">{user.empId}</TableCell>
                      <TableCell>{user.empName || '-'}</TableCell>
                      <TableCell>{user.email || '-'}</TableCell>
                      <TableCell>
                        <Badge className={user.onDuty ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-muted-foreground'}>
                          {user.onDuty ? 'On duty' : 'Off duty'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TableRowActions
                          onHide={() => void hideUser(user.empId)}
                          onDelete={() => void deleteUser(user.empId)}
                        />
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
    </div>
  );
}
