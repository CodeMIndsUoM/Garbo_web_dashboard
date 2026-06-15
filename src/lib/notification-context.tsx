'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type { PageType } from '@/app/page';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/notification-api';
import { subscribeNotificationRealtime } from '@/lib/notification-realtime';

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  navigateFromNotification: (notification: AppNotification) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
  children: ReactNode;
  userId: number | null;
  onNavigate: (page: PageType) => void;
}

function resolveUserId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem('userId');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function NotificationProvider({
  children,
  userId: userIdProp,
  onNavigate,
}: NotificationProviderProps) {
  const userId = userIdProp ?? resolveUserId();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsConnectedRef = useRef(false);

  const prependNotification = useCallback((notification: AppNotification) => {
    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== notification.id);
      return [notification, ...filtered].slice(0, 50);
    });
    if (!notification.read) {
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const [rows, count] = await Promise.all([
        fetchNotifications(userId),
        fetchUnreadCount(userId),
      ]);
      setNotifications(rows);
      setUnreadCount(count);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await markNotificationRead(id);
    },
    []
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await markAllNotificationsRead(userId);
  }, [userId]);

  const navigateFromNotification = useCallback(
    (notification: AppNotification) => {
      const type = notification.type?.toUpperCase() ?? '';
      const data = notification.data ?? {};

      switch (type) {
        case 'COMPLAINT_SUBMITTED':
          onNavigate('external-users');
          break;
        case 'BIN_SUGGESTION_SUBMITTED':
          onNavigate('internal-users');
          break;
        case 'BIN_DISCREPANCY_REPORTED':
          onNavigate('bins');
          break;
        case 'THIRD_PARTY_REGISTRATION_PENDING':
          onNavigate('external-users');
          break;
        case 'EVENT_SUGGESTION_SUBMITTED':
          onNavigate('internal-users');
          break;
        default:
          if (data.complaintId) onNavigate('external-users');
          else if (data.suggestionId) onNavigate('internal-users');
          else if (data.binId) onNavigate('bins');
          else if (data.collectorId) onNavigate('external-users');
          break;
      }
    },
    [onNavigate]
  );

  useEffect(() => {
    if (!userId) return;

    void refresh();

    const cleanupWs = subscribeNotificationRealtime({
      userId,
      onConnect: () => {
        wsConnectedRef.current = true;
      },
      onMessage: (message) => {
        const notification = message.notification;
        prependNotification(notification);

        const priority = notification.priority?.toUpperCase();
        if (
          priority === 'HIGH' &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible'
        ) {
          toast(notification.title, {
            description: notification.body,
            action: {
              label: 'View',
              onClick: () => navigateFromNotification(notification),
            },
          });
        }
      },
    });

    pollRef.current = setInterval(() => {
      if (!wsConnectedRef.current) {
        void refresh();
      }
    }, 60_000);

    return () => {
      cleanupWs();
      wsConnectedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userId, refresh, prependNotification, navigateFromNotification]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      refresh,
      markRead,
      markAllRead,
      navigateFromNotification,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      refresh,
      markRead,
      markAllRead,
      navigateFromNotification,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return ctx;
}
