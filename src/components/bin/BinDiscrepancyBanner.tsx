'use client';

import { TriangleAlert } from 'lucide-react';
import { normalizeBinStatus } from '@/lib/bin-realtime';

export interface BinDiscrepancyInfo {
  hasDiscrepancy?: boolean;
  discrepancyStatus?: string;
  discrepancyPreviousStatus?: string;
  discrepancyReporterName?: string;
  assignedToName?: string;
}

function statusLabel(status?: string): string {
  const key = normalizeBinStatus(status);
  if (key === 'full') return 'FULL';
  if (key === 'half') return 'HALF';
  if (key === 'empty') return 'EMPTY';
  return (status || 'UNKNOWN').toUpperCase();
}

export function buildDiscrepancyMessage(bin: BinDiscrepancyInfo): string {
  const reporter = bin.discrepancyReporterName || bin.assignedToName || 'Field mentor';
  const reported = statusLabel(bin.discrepancyStatus);
  const previous = statusLabel(bin.discrepancyPreviousStatus || 'empty');
  const suffix = previous === 'EMPTY' ? ' (e.g. after collection)' : '';
  return `${reporter} reported ${reported}, but the bin was previously marked ${previous}${suffix}.`;
}

interface BinDiscrepancyBannerProps {
  bin: BinDiscrepancyInfo;
  compact?: boolean;
}

export function BinDiscrepancyBanner({ bin, compact = false }: BinDiscrepancyBannerProps) {
  if (!bin.hasDiscrepancy) {
    return null;
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      }`}
    >
      <TriangleAlert className={`shrink-0 text-amber-600 ${compact ? 'mt-0.5 h-4 w-4' : 'mt-0.5 h-5 w-5'}`} />
      <div>
        <p className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>Status discrepancy reported</p>
        <p className={`mt-1 text-amber-800 ${compact ? 'text-[11px] leading-snug' : 'text-xs'}`}>
          {buildDiscrepancyMessage(bin)}
        </p>
      </div>
    </div>
  );
}
