'use client';

import { Bell } from 'lucide-react';
import { useNotifications } from '@/lib/notification-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function formatWhen(createdAt?: string): string {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationBell({ menuSide = 'bottom' }: { menuSide?: 'top' | 'bottom' }) {
  const {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    markRead,
    markAllRead,
    navigateFromNotification,
  } = useNotifications();

  const recent = notifications.slice(0, 5);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={menuSide} align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-brand-600 hover:underline"
              onClick={() => void markAllRead()}
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && recent.length === 0 ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : recent.length === 0 ? (
          <DropdownMenuItem disabled>No notifications yet</DropdownMenuItem>
        ) : (
          recent.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex cursor-pointer flex-col items-start gap-1 py-2"
              onClick={() => {
                if (!notification.read) void markRead(notification.id);
                navigateFromNotification(notification);
              }}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="text-sm font-semibold leading-tight">
                  {notification.title}
                </span>
                {!notification.read ? (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                ) : null}
              </div>
              {notification.body ? (
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {notification.body}
                </span>
              ) : null}
              <span className="text-[10px] text-muted-foreground">
                {formatWhen(notification.createdAt)}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void refresh()}>Refresh</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
