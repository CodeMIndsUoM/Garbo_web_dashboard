'use client';

import { useEffect, useRef } from 'react';
import {
  subscribeBinRealtime,
  type BinRealtimeMessage,
} from '@/lib/bin-realtime';

export interface UseBinRealtimeOptions {
  councilName?: string | null;
  enabled?: boolean;
  onUpdate: (message: BinRealtimeMessage) => void;
}

export function useBinRealtime({
  councilName,
  enabled = true,
  onUpdate,
}: UseBinRealtimeOptions): void {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    return subscribeBinRealtime({
      councilName,
      onMessage: (message) => onUpdateRef.current(message),
    });
  }, [councilName, enabled]);
}
