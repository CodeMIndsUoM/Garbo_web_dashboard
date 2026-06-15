'use client';

import { TriangleAlert } from 'lucide-react';

export interface BinDiscrepancyInfo {
  hasDiscrepancy?: boolean;
  discrepancyStatus?: string;
  discrepancyPreviousStatus?: string;
  discrepancyReporterName?: string;
  assignedToName?: string;
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
      className={`flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      }`}
    >
      <TriangleAlert
        className={`shrink-0 text-amber-600 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`}
        aria-hidden
      />
      <p className={`font-semibold leading-none ${compact ? 'text-[11px]' : 'text-xs'}`}>
        Status discrepancy reported
      </p>
    </div>
  );
}
