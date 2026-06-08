'use client';

import { Camera, Frown, Loader2, Meh, Smile, X } from 'lucide-react';
import { normalizeBinStatus } from '@/lib/bin-realtime';

export interface BinReportDetail {
  reportId?: number;
  binId: number;
  binCode: string;
  council?: string;
  status: string;
  fillLevel?: number;
  notes?: string | null;
  photoUrl?: string | null;
  reporterName?: string | null;
  reportedAt?: string | null;
}

function resolveMediaUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081').replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

const STATUS_OPTIONS = [
  {
    key: 'empty',
    label: 'Empty',
    description: 'Bin is empty or near empty',
    icon: Smile,
    activeClass: 'border-green-400 bg-green-50/80 ring-2 ring-green-300',
    iconClass: 'text-green-600',
  },
  {
    key: 'half',
    label: 'Half Full',
    description: 'Bin is about halfway filled',
    icon: Meh,
    activeClass: 'border-yellow-400 bg-yellow-50/80 ring-2 ring-yellow-300',
    iconClass: 'text-yellow-600',
  },
  {
    key: 'full',
    label: 'Full',
    description: 'Bin is full or overflowing',
    icon: Frown,
    activeClass: 'border-red-400 bg-red-50/80 ring-2 ring-red-300',
    iconClass: 'text-red-600',
  },
] as const;

interface BinReportDetailDialogProps {
  open: boolean;
  onClose: () => void;
  bin: { id: number; binCode: string; council?: string; status: string } | null;
  report: BinReportDetail | null;
  loading?: boolean;
}

export function BinReportDetailDialog({
  open,
  onClose,
  bin,
  report,
  loading = false,
}: BinReportDetailDialogProps) {
  if (!open || !bin) return null;

  const activeStatus = normalizeBinStatus(report?.status ?? bin.status);
  const photoSrc = resolveMediaUrl(report?.photoUrl);
  const badgeLabel = [bin.binCode, bin.council].filter(Boolean).join(' | ');

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/25 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/40 bg-white/75 backdrop-blur-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bin-report-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/30 bg-white/60 px-5 py-4 backdrop-blur-md">
          <h2 id="bin-report-title" className="text-base font-bold text-slate-800">
            Report Bin Status
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 px-3 py-1 text-sm font-medium text-slate-700">
            {badgeLabel}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm">Loading report details...</p>
            </div>
          ) : !report ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center text-sm text-slate-500">
              No field staff report on record for this bin yet.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Select Fill Level</p>
                <div className="space-y-2">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isActive = activeStatus === option.key;
                    return (
                      <div
                        key={option.key}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                          isActive
                            ? option.activeClass
                            : 'border-slate-200 bg-white/50 opacity-60'
                        }`}
                      >
                        <Icon className={`h-6 w-6 shrink-0 ${option.iconClass}`} />
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{option.label}</p>
                          <p className="text-xs text-slate-500">{option.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Issue Notes (Optional)</p>
                <div className="min-h-[72px] rounded-xl border border-slate-200 bg-white/60 px-3 py-2.5 text-sm text-slate-700">
                  {report.notes?.trim() ? report.notes : (
                    <span className="text-slate-400">No notes provided.</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Attach Photo (Optional)</p>
                {photoSrc ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/60">
                    <img
                      src={photoSrc}
                      alt="Bin report attachment"
                      className="max-h-64 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-slate-400">
                    <Camera className="mb-2 h-8 w-8" />
                    <p className="text-sm">No photo attached</p>
                  </div>
                )}
              </div>

              {(report.reporterName || report.reportedAt) && (
                <p className="text-xs text-slate-500">
                  {report.reporterName ? `Reported by ${report.reporterName}` : 'Reported'}
                  {report.reportedAt ? ` · ${new Date(report.reportedAt).toLocaleString()}` : ''}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
