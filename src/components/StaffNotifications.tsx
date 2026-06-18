'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import {
  sendAdminBroadcast,
  sendAdminDirectNotification,
  type BroadcastAudience,
} from '@/lib/admin-broadcast-api';
import { isSuperadmin } from '@/lib/auth';
import { COUNCILS } from '@/lib/council-context';
import type { ApiListResponse } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PageHeader } from './layout/PageHeader';
import { FormActions, FormField, FormPanel, FormSelect } from './layout/management-ui';

type BroadcastMode = 'group' | 'individual';

interface StaffMember {
  empId: number;
  empName?: string;
  email?: string;
  role?: string;
}

export function StaffNotifications({
  council,
  onBack,
}: {
  council?: { id?: string; name?: string } | null;
  onBack?: () => void;
}) {
  const superadmin = isSuperadmin();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<BroadcastMode>('group');
  const [audience, setAudience] = useState<BroadcastAudience>('ALL_INTERNAL');
  const [recipientId, setRecipientId] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH'>('NORMAL');
  const [broadcastCouncil, setBroadcastCouncil] = useState(council?.name || '');
  const [sending, setSending] = useState(false);

  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      let path = '/api/admins/staff';
      const councilName = council?.name;
      if (superadmin && councilName) {
        path += `?council=${encodeURIComponent(councilName)}`;
      }
      const { response, data } = await apiFetch<ApiListResponse<StaffMember[]>>(path);
      if (!response.ok) {
        setStaff([]);
        return;
      }
      setStaff(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setStaff([]);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    void loadStaff();
  }, [council?.id]);

  useEffect(() => {
    if (council?.name) {
      setBroadcastCouncil(council.name);
    }
  }, [council?.name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error('Title and message are required');
      return;
    }

    if (mode === 'individual') {
      const empId = Number(recipientId);
      if (!recipientId || Number.isNaN(empId)) {
        toast.error('Please select a staff member');
        return;
      }
    }

    setSending(true);
    try {
      if (mode === 'individual') {
        const empId = Number(recipientId);
        await sendAdminDirectNotification({
          empId,
          title: title.trim(),
          body: body.trim(),
          priority,
        });
        const recipient = staff.find((u) => u.empId === empId);
        toast.success(
          `Notification sent to ${recipient?.empName || recipient?.email || 'staff member'}`
        );
      } else {
        const result = await sendAdminBroadcast({
          title: title.trim(),
          body: body.trim(),
          audience,
          priority,
          council: superadmin && broadcastCouncil.trim() ? broadcastCouncil.trim() : undefined,
        });
        toast.success(`Message sent to ${result.recipientCount} staff member(s)`);
      }
      setTitle('');
      setBody('');
      setRecipientId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 p-3 sm:space-y-6 sm:p-4 md:p-8">
      <PageHeader
        title="Staff Notifications"
        subtitle="Send one-way messages to field mentors and bin collectors. Recipients see them in the mobile app inbox and cannot reply."
        extra={council?.name ? `Council context: ${council.name}` : undefined}
        actions={
          onBack ? (
            <Button type="button" variant="outline" className="gap-2" onClick={onBack}>
              <ArrowLeft className="size-4" />
              Back to Internal Users
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-4 h-4" />
            Send Staff Notification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FormPanel>
              <FormField label="Delivery" htmlFor="notification-mode">
                <FormSelect
                  id="notification-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as BroadcastMode)}
                >
                  <option value="group">Group — all staff or a role</option>
                  <option value="individual">Individual — one selected user</option>
                </FormSelect>
              </FormField>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <FormField label="Title" htmlFor="notification-title">
                  <Input
                    id="notification-title"
                    placeholder="e.g. Route change tomorrow"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={255}
                    required
                  />
                </FormField>
                {mode === 'group' ? (
                  <FormField label="Send to" htmlFor="notification-audience">
                    <FormSelect
                      id="notification-audience"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as BroadcastAudience)}
                    >
                      <option value="ALL_INTERNAL">All internal staff</option>
                      <option value="FIELD_MENTOR">Field mentors only</option>
                      <option value="BIN_COLLECTOR">Bin collectors only</option>
                    </FormSelect>
                  </FormField>
                ) : (
                  <FormField label="Staff member" htmlFor="notification-recipient">
                    <FormSelect
                      id="notification-recipient"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      required
                      disabled={staffLoading}
                    >
                      <option value="">
                        {staffLoading ? 'Loading staff...' : 'Select a staff member'}
                      </option>
                      {staff.map((user) => (
                        <option key={user.empId} value={String(user.empId)}>
                          {user.empName || user.email || `User #${user.empId}`}
                          {user.role ? ` (${user.role.replace(/_/g, ' ')})` : ''}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                )}
              </div>

              <FormField label="Message" htmlFor="notification-body">
                <Textarea
                  id="notification-body"
                  placeholder="Write your announcement..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  maxLength={4000}
                  required
                />
              </FormField>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-w-xl">
                <FormField label="Priority" htmlFor="notification-priority">
                  <FormSelect
                    id="notification-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as 'NORMAL' | 'HIGH')}
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High (toast alert on dashboard)</option>
                  </FormSelect>
                </FormField>
                {superadmin ? (
                  <FormField label="Council (optional)" htmlFor="notification-council">
                    <FormSelect
                      id="notification-council"
                      value={broadcastCouncil}
                      onChange={(e) => setBroadcastCouncil(e.target.value)}
                      disabled={mode === 'individual'}
                    >
                      <option value="">All councils</option>
                      {COUNCILS.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                ) : null}
              </div>
            </FormPanel>
            <FormActions>
              <Button type="submit" variant="brand" disabled={sending}>
                {sending
                  ? 'Sending...'
                  : mode === 'individual'
                    ? 'Send to selected user'
                    : 'Send notification'}
              </Button>
            </FormActions>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
