import SockJS from 'sockjs-client';
import { Client, IMessage } from '@stomp/stompjs';
import { getApiBase } from './api';

export type BinRealtimeMessageType = 'BIN_STATUS_UPDATED' | 'BIN_COLLECTED';

export interface BinRealtimeMessage {
  type: BinRealtimeMessageType;
  binId: number;
  status?: string;
  fillLevel?: number;
  council?: string;
  changeType?: string;
  collectionStatus?: string;
  sessionId?: string;
  timestamp?: number;
  reportId?: number;
  notes?: string;
  photoUrl?: string;
  reporterName?: string;
  reportedAt?: string;
  hasDiscrepancy?: boolean;
  discrepancy?: boolean;
  previousStatus?: string;
}

/** Normalize backend status strings for UI comparisons. */
export function normalizeBinStatus(status?: string | null): string {
  if (!status) return 'notChecked';
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'notchecked' || normalized === 'not_checked') return 'notChecked';
  return normalized;
}

/** Matches backend CouncilBinStompBroadcaster.councilTopicKey */
export function councilTopicKey(name?: string | null): string {
  if (!name || !name.trim()) return 'all';
  return name.trim().replace(/\s+/g, '_');
}

export function councilBinTopic(councilName?: string | null): string {
  return `/topic/councils/${councilTopicKey(councilName)}/bins`;
}

/** Visual bin state after a route stop is collected (bin row may not be updated in DB yet). */
export function applyCollectionVisualUpdate(
  msg: BinRealtimeMessage
): { status?: string; fillLevel?: number } {
  if (msg.type !== 'BIN_COLLECTED' || msg.collectionStatus !== 'COLLECTED') {
    return {
      status: msg.status ? normalizeBinStatus(msg.status) : undefined,
      fillLevel: msg.fillLevel,
    };
  }
  return {
    status: normalizeBinStatus(msg.status ?? 'empty'),
    fillLevel: msg.fillLevel ?? 0,
  };
}

function parseMessage(body: string): BinRealtimeMessage | null {
  try {
    const raw = JSON.parse(body) as Partial<BinRealtimeMessage>;
    if (!raw.binId || !raw.type) return null;
    if (raw.type !== 'BIN_STATUS_UPDATED' && raw.type !== 'BIN_COLLECTED') return null;
    return raw as BinRealtimeMessage;
  } catch {
    return null;
  }
}

export interface SubscribeBinRealtimeOptions {
  councilName?: string | null;
  onMessage: (message: BinRealtimeMessage) => void;
  onConnect?: () => void;
}

/**
 * Subscribe to council-scoped bin STOMP updates. Returns a cleanup that deactivates the client.
 */
export function subscribeBinRealtime({
  councilName,
  onMessage,
  onConnect,
}: SubscribeBinRealtimeOptions): () => void {
  const topic = councilBinTopic(councilName);
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
      const parsed = parseMessage(message.body);
      if (parsed) onMessageRef.current(parsed);
    });
  };

  client.activate();

  return () => {
    void client.deactivate();
  };
}
