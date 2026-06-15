'use client';

import { useEffect, useMemo, useState } from 'react';
import { HardHat, MapPin, Megaphone, Trash2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { sendAdminDirectNotification } from '@/lib/admin-broadcast-api';
import { isSuperadmin } from '@/lib/auth';
import { COUNCILS } from '@/lib/council-context';
import type { ApiListResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
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

import {
  binSuggestionImageUrl,
  binSuggestionStatusBadgeClass,
  binSuggestionStatusLabel,
  binSuggestionTitle,
  filterBinSuggestionsByCouncil,
  isPendingBinSuggestion,
  patchBinSuggestionStatus,
  type BinSuggestionItem,
} from '@/lib/bin-suggestions';

type InternalSection = 'field-staff' | 'bin-collectors' | 'bin-suggestions';
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

export function InternalUsers({
  council,
  onNavigate,
}: {
  council?: { id?: string; name?: string } | null;
  onNavigate?: (page: string) => void;
}) {
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
  const [editUser, setEditUser] = useState<InternalUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [directMessageSending, setDirectMessageSending] = useState(false);
  const [messageUser, setMessageUser] = useState<InternalUser | null>(null);
  const [directMessageTitle, setDirectMessageTitle] = useState('');
  const [directMessageBody, setDirectMessageBody] = useState('');
  const [directMessagePriority, setDirectMessagePriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');

  const [suggestions, setSuggestions] = useState<BinSuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [actingSuggestionId, setActingSuggestionId] = useState<number | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<number | null>(null);
  const [suggestionDetail, setSuggestionDetail] = useState<BinSuggestionItem | null>(null);
  const [suggestionDetailLoading, setSuggestionDetailLoading] = useState(false);
  const [suggestionResolutionNotes, setSuggestionResolutionNotes] = useState('');

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

  const sendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageUser) return;
    if (!directMessageTitle.trim() || !directMessageBody.trim()) {
      toast.error('Title and message are required');
      return;
    }

    setDirectMessageSending(true);
    try {
      await sendAdminDirectNotification({
        empId: messageUser.empId,
        title: directMessageTitle.trim(),
        body: directMessageBody.trim(),
        priority: directMessagePriority,
      });
      toast.success(`Notification sent to ${messageUser.empName || messageUser.email || 'staff member'}`);
      setMessageUser(null);
      setDirectMessageTitle('');
      setDirectMessageBody('');
      setDirectMessagePriority('NORMAL');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setDirectMessageSending(false);
    }
  };

  const openDirectMessage = (user: InternalUser) => {
    setMessageUser(user);
    setDirectMessageTitle('');
    setDirectMessageBody('');
    setDirectMessagePriority('NORMAL');
  };

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const { response, data } = await apiFetch<BinSuggestionItem[]>('/api/bin-suggestions');
      if (!response.ok) {
        toast.error('Failed to load bin suggestions');
        setSuggestions([]);
        return;
      }
      const raw = Array.isArray(data) ? data : [];
      const filtered = filterBinSuggestionsByCouncil(raw, council?.name);
      filtered.sort((a, b) => {
        const aPending = isPendingBinSuggestion(a.status) ? 0 : 1;
        const bPending = isPendingBinSuggestion(b.status) ? 0 : 1;
        if (aPending !== bPending) return aPending - bPending;
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      setSuggestions(filtered);
    } catch {
      toast.error('Network error while loading bin suggestions');
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    void loadSuggestions();
  }, [council?.id]);

  const openSuggestion = async (id: number) => {
    setSelectedSuggestionId(id);
    setSuggestionDetailLoading(true);
    try {
      const { data } = await apiFetch<BinSuggestionItem>(`/api/bin-suggestions/${id}`);
      setSuggestionDetail(data);
      setSuggestionResolutionNotes(data.resolutionNotes || '');
    } catch {
      toast.error('Could not load suggestion details');
      setSelectedSuggestionId(null);
    } finally {
      setSuggestionDetailLoading(false);
    }
  };

  const updateSuggestion = async (
    id: number,
    status: 'APPROVED' | 'REJECTED',
    notes?: string,
  ) => {
    setActingSuggestionId(id);
    try {
      await patchBinSuggestionStatus(id, status, notes);
      toast.success(status === 'APPROVED' ? 'Bin suggestion approved' : 'Bin suggestion rejected');
      if (selectedSuggestionId === id) {
        setSelectedSuggestionId(null);
        setSuggestionDetail(null);
        setSuggestionResolutionNotes('');
      }
      void loadSuggestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update bin suggestion');
    } finally {
      setActingSuggestionId(null);
    }
  };

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

  const openEditUser = (user: InternalUser) => {
    setEditUser(user);
    setEditName(user.empName || '');
    setEditPhone('');
  };

  const saveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditSaving(true);
    try {
      const isMentor = isFieldStaff(editUser);
      const path = isMentor
        ? `/api/admins/staff/field-mentors/${editUser.empId}`
        : `/api/admins/staff/bin-collectors/${editUser.empId}`;
      const { response, data } = await apiFetch<ApiListResponse<unknown>>(path, {
        method: 'PUT',
        body: JSON.stringify({
          fullName: editName.trim(),
          contactNumber: editPhone.trim() || undefined,
        }),
      });
      if (!response.ok) {
        toast.error(data?.message || 'Failed to update user');
        return;
      }
      toast.success('User updated');
      setEditUser(null);
      void loadData();
    } catch {
      toast.error('Network error while updating user');
    } finally {
      setEditSaving(false);
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
    {
      id: 'bin-suggestions',
      label: 'Bin Suggestions',
      icon: <MapPin className="size-4" />,
      count: suggestions.filter((s) => isPendingBinSuggestion(s.status)).length,
      description: 'Review new bin location suggestions from field mentors.',
    },
  ];

  const sectionTitle =
    section === 'field-staff'
      ? 'Field Staff'
      : section === 'bin-collectors'
        ? 'Bin Collectors'
        : 'Bin Suggestions';
  const createLabel = section === 'field-staff' ? 'Create Field Staff' : 'Create Bin Collector';
  const showStaffManagement = section !== 'bin-suggestions';

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Internal Users"
        subtitle="Manage field staff and bin collectors for your council."
        extra={council?.name ? `Council context: ${council.name}` : undefined}
        actions={
          <Button
            type="button"
            variant="brand"
            className="gap-2"
            onClick={() => onNavigate?.('staff-notifications')}
          >
            <Megaphone className="size-4" />
            New notification
          </Button>
        }
      />

      <PageSubSectionNav
        title="Staff type"
        items={internalSections}
        active={section}
        onChange={setSection}
      />

      <div className="space-y-6">
      {showStaffManagement ? (
      <>
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
      </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Field Mentor Bin Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            {suggestionsLoading ? (
              <p className="text-muted-foreground">Loading suggestions...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-muted-foreground">No bin suggestions found.</p>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion) => {
                  const pending = isPendingBinSuggestion(suggestion.status);
                  const isActing = actingSuggestionId === suggestion.id;
                  return (
                    <div
                      key={suggestion.id}
                      className="p-4 border border-border rounded-lg hover:border-green-300 hover:bg-green-50/30 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                    >
                      <button
                        type="button"
                        onClick={() => void openSuggestion(suggestion.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="text-foreground font-medium">{binSuggestionTitle(suggestion)}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {suggestion.location || 'No location'}
                        </p>
                        {suggestion.mentorName && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Suggested by: {suggestion.mentorName}
                          </p>
                        )}
                        {suggestion.category && (
                          <p className="text-xs text-muted-foreground mt-1">Category: {suggestion.category}</p>
                        )}
                        {suggestion.createdAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(suggestion.createdAt).toLocaleString()}
                          </p>
                        )}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={binSuggestionStatusBadgeClass(suggestion.status)}>
                          {binSuggestionStatusLabel(suggestion.status)}
                        </Badge>
                        {pending && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              disabled={isActing}
                              onClick={() => void updateSuggestion(suggestion.id, 'APPROVED')}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isActing}
                              onClick={() => void updateSuggestion(suggestion.id, 'REJECTED')}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showStaffManagement ? (
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
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openDirectMessage(user)}
                          >
                            Notify
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditUser(user)}>
                            Edit
                          </Button>
                          <TableRowActions
                            onHide={() => void hideUser(user.empId)}
                            onDelete={() => void deleteUser(user.empId)}
                          />
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
      ) : null}
      {editUser ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit {editUser.empName || `User #${editUser.empId}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveEditUser}>
              <FormPanel>
                <FormField label="Full name" htmlFor="edit-full-name">
                  <Input
                    id="edit-full-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Contact number" htmlFor="edit-contact">
                  <Input
                    id="edit-contact"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </FormField>
              </FormPanel>
              <FormActions>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="brand" disabled={editSaving}>
                  {editSaving ? 'Saving...' : 'Save changes'}
                </Button>
              </FormActions>
            </form>
          </CardContent>
        </Card>
      ) : null}
      {messageUser ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Send notification
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  To {messageUser.empName || messageUser.email || `User #${messageUser.empId}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMessageUser(null)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={sendDirectMessage} className="p-5 space-y-4">
              <FormField label="Title" htmlFor="direct-message-title">
                <Input
                  id="direct-message-title"
                  placeholder="Notification title"
                  value={directMessageTitle}
                  onChange={(e) => setDirectMessageTitle(e.target.value)}
                  maxLength={255}
                  required
                />
              </FormField>
              <FormField label="Message" htmlFor="direct-message-body">
                <Textarea
                  id="direct-message-body"
                  placeholder="Write your message..."
                  value={directMessageBody}
                  onChange={(e) => setDirectMessageBody(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  required
                />
              </FormField>
              <FormField label="Priority" htmlFor="direct-message-priority">
                <FormSelect
                  id="direct-message-priority"
                  value={directMessagePriority}
                  onChange={(e) => setDirectMessagePriority(e.target.value as 'NORMAL' | 'HIGH')}
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                </FormSelect>
              </FormField>
              <p className="text-xs text-muted-foreground">
                This is a one-way message. The recipient will see it in their mobile app inbox and cannot reply.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setMessageUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="brand" disabled={directMessageSending}>
                  {directMessageSending ? 'Sending...' : 'Send notification'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedSuggestionId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">
                Bin Suggestion #{selectedSuggestionId}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSelectedSuggestionId(null);
                  setSuggestionDetail(null);
                }}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {suggestionDetailLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : suggestionDetail ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={binSuggestionStatusBadgeClass(suggestionDetail.status)}>
                      {binSuggestionStatusLabel(suggestionDetail.status)}
                    </Badge>
                    {suggestionDetail.mentorName && (
                      <span className="text-xs text-muted-foreground">
                        Mentor: {suggestionDetail.mentorName}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {binSuggestionTitle(suggestionDetail)}
                    </p>
                    {suggestionDetail.category && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Category: {suggestionDetail.category}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      {suggestionDetail.location || 'No location provided'}
                    </p>
                    {suggestionDetail.notes && (
                      <p className="text-sm text-foreground mt-3 whitespace-pre-wrap">
                        {suggestionDetail.notes}
                      </p>
                    )}
                  </div>
                  {binSuggestionImageUrl(suggestionDetail.imageUrl) && (
                    <img
                      src={binSuggestionImageUrl(suggestionDetail.imageUrl)!}
                      alt="Suggestion"
                      className="rounded-lg border border-border max-h-48 object-cover w-full"
                    />
                  )}
                  {suggestionDetail.resolutionNotes && (
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-xs font-medium text-muted-foreground">Resolution notes</p>
                      <p className="text-sm text-foreground mt-1">{suggestionDetail.resolutionNotes}</p>
                    </div>
                  )}
                  {suggestionDetail.createdBinId && (
                    <p className="text-sm text-status-success">
                      Created bin ID: {suggestionDetail.createdBinId}
                    </p>
                  )}
                  {isPendingBinSuggestion(suggestionDetail.status) && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <FormField label="Resolution notes (optional)" htmlFor="suggestion-notes">
                        <Input
                          id="suggestion-notes"
                          placeholder="Add notes for the mentor"
                          value={suggestionResolutionNotes}
                          onChange={(e) => setSuggestionResolutionNotes(e.target.value)}
                        />
                      </FormField>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          disabled={actingSuggestionId === suggestionDetail.id}
                          onClick={() =>
                            void updateSuggestion(
                              suggestionDetail.id,
                              'REJECTED',
                              suggestionResolutionNotes,
                            )
                          }
                        >
                          Reject
                        </Button>
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          disabled={actingSuggestionId === suggestionDetail.id}
                          onClick={() =>
                            void updateSuggestion(
                              suggestionDetail.id,
                              'APPROVED',
                              suggestionResolutionNotes,
                            )
                          }
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Suggestion not found.</p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
