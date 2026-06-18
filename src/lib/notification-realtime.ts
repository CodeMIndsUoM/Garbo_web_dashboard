import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import { getApiBase } from './api';
import type { AppNotification } from './notification-api';

export interface NotificationCreatedMessage {
  type: 'NOTIFICATION_CREATED';
  notification: AppNotification;
  updatedAt?: number;
}

function parseNotificationMessage(body: string): NotificationCreatedMessage | null {
  try {
    const raw = JSON.parse(body) as Partial<NotificationCreatedMessage> & {
      notification?: AppNotification;
    };
    if (raw.type !== 'NOTIFICATION_CREATED' || !raw.notification?.id) {
      return null;
    }
    return {
      type: 'NOTIFICATION_CREATED',
      notification: {
        ...raw.notification,
        read:
          raw.notification.read === true ||
          (raw.notification as { isRead?: boolean }).isRead === true,
      },
      updatedAt: raw.updatedAt,
    };
  } catch {
    return null;
  }
}

export interface SubscribeNotificationRealtimeOptions {
  userId: number;
  onMessage: (message: NotificationCreatedMessage) => void;
  onConnect?: () => void;
}

export function subscribeNotificationRealtime({
  userId,
  onMessage,
  onConnect,
}: SubscribeNotificationRealtimeOptions): () => void {
  const topic = `/topic/users/${userId}/notifications`;
  const onMessageRef = { current: onMessage };
  onMessageRef.current = onMessage;

  const client = new Client({
    webSocketFactory: () => new SockJS(`${getApiBase()}/ws`),
    reconnectDelay: 3000,
    debug: () => {},
  });

  client.onConnect = () => {
    onConnect?.();
    client.subscribe(topic, (message: IMessage) => {
      const parsed = parseNotificationMessage(message.body);
      if (parsed) onMessageRef.current(parsed);
    });
  };

  client.activate();

  return () => {
    void client.deactivate();
  };
}
