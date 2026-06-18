import { apiFetch } from './api';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt?: string;
  data?: Record<string, unknown>;
  priority?: string;
}

export async function fetchNotifications(
  empId: number,
  options?: { limit?: number; unreadOnly?: boolean; cursor?: string }
): Promise<AppNotification[]> {
  const params = new URLSearchParams();
  params.set('limit', String(options?.limit ?? 50));
  if (options?.unreadOnly) params.set('unreadOnly', 'true');
  if (options?.cursor) params.set('cursor', options.cursor);

  const { response, data } = await apiFetch<{ success?: boolean; data?: AppNotification[] }>(
    `/api/users/${empId}/notifications?${params.toString()}`
  );

  if (!response.ok || !Array.isArray(data?.data)) return [];
  return data.data.map((row) => ({
    ...row,
    read: row.read === true || (row as { isRead?: boolean }).isRead === true,
  }));
}

export async function fetchUnreadCount(empId: number): Promise<number> {
  const { response, data } = await apiFetch<{ success?: boolean; data?: { count?: number } }>(
    `/api/users/${empId}/notifications/unread-count`
  );
  if (!response.ok) return 0;
  return data?.data?.count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<boolean> {
  const { response } = await apiFetch(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
  return response.ok;
}

export async function markAllNotificationsRead(empId: number): Promise<boolean> {
  const { response } = await apiFetch(`/api/users/${empId}/notifications/read-all`, {
    method: 'PATCH',
  });
  return response.ok;
}
