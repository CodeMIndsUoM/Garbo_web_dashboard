import { apiFetch } from './api';

export type BroadcastAudience = 'ALL_INTERNAL' | 'FIELD_MENTOR' | 'BIN_COLLECTOR';

export interface AdminBroadcastRequest {
  title: string;
  body: string;
  audience?: BroadcastAudience;
  council?: string;
  recipientIds?: number[];
  priority?: 'NORMAL' | 'HIGH';
}

export interface AdminBroadcastResult {
  broadcastId: string;
  recipientCount: number;
  council?: string;
  audience?: string;
}

export async function sendAdminBroadcast(
  payload: AdminBroadcastRequest
): Promise<AdminBroadcastResult> {
  const { response, data } = await apiFetch<{
    success?: boolean;
    data?: AdminBroadcastResult;
    message?: string;
  }>('/api/admins/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to send message');
  }

  if (!data?.data?.broadcastId) {
    throw new Error('Broadcast succeeded but no confirmation was returned');
  }

  return data.data;
}

export interface AdminDirectMessageRequest {
  empId: number;
  title: string;
  body: string;
  priority?: 'NORMAL' | 'HIGH';
}

export async function sendAdminDirectNotification(
  payload: AdminDirectMessageRequest
): Promise<AdminBroadcastResult & { recipientEmpId?: number }> {
  const { response, data } = await apiFetch<{
    success?: boolean;
    data?: AdminBroadcastResult & { recipientEmpId?: number };
    message?: string;
  }>('/api/admins/notifications/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to send notification');
  }

  if (!data?.data?.broadcastId) {
    throw new Error('Send succeeded but no confirmation was returned');
  }

  return data.data;
}
