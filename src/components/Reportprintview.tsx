'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZoneAnalytics {
  zone:           string;
  total?:         number;
  highPriority?:  number;
  mediumPriority?: number;
  lowPriority?:   number;
}

interface ZoneCollection {
  zone:      string;
  collected: number;
}

interface ChartData {
  label:     string;
  assigned:  number;
  collected: number;
  missed:    number;
}

interface ReportSnapshot {
  periodLabel:  string;
  generatedAt:  string;

  collection: {
    assigned:  number;
    collected: number;
    missed:    number;
    chartData: ChartData[];
  };

  zoneCollection: ZoneCollection[];

  binAnalytics: {
    totalBins: number;
    zoneData:  ZoneAnalytics[];
  };

  complaints: {
    period:    string;
    summary:   any;
    chartData: any[];
  };

  staff: {
  summary: {
    totalStaff:     number;
    onDutyCount:    number;
    onLeaveCount:   number;
    attendanceRate: number;
    avgPerformance: number;
  };
};

  thirdParty: {
    totalRequests:  number;
    completionRate: number;
  };

  vehicleTypeSnapshot: Record<string, number>;
}

interface ReportPrintViewProps {
  snapshot:  ReportSnapshot;
  reportId:  number;
  onClose:   () => void;
}

// ── Colour palettes ───────────────────────────────────────────────────────────
const ZONE_COLORS = ['#16a34a', '#2563eb', '#d97706', '#7c3aed', '#dc2626'];

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 20px',
      background: '#f9fafb', minWidth: 130, flex: '1 1 130px',
    }}>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 14, fontWeight: 700, color: '#166534',
      textTransform: 'uppercase', letterSpacing: '0.08em',
      borderBottom: '2px solid #16a34a', paddingBottom: 6,
      marginTop: 32, marginBottom: 16,
    }}>
      {children}
    </h2>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReportPrintView({ snapshot, reportId, onClose }: ReportPrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;

    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(el => el.outerHTML).join('\n');
    const styleTags = Array.from(document.querySelectorAll('style'))
      .map(el => el.outerHTML).join('\n');

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Garbo Report #${reportId}</title>
    ${styleLinks}
    ${styleTags}
    <style>
      @page { margin: 18mm 15mm; size: A4; }
      body  { margin: 0; padding: 0; font-family: Georgia, serif; color: #111827; }
      .no-print { display: none !important; }
    </style>
  </head>
  <body>${content}</body>
</html>`);
    doc.close();

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }
    };
  }, [reportId]);

  const { collection, zoneCollection, binAnalytics, complaints, staff, thirdParty, vehicleTypeSnapshot } = snapshot;

  const collectionRate = collection.assigned > 0
    ? ((collection.collected / collection.assigned) * 100).toFixed(1)
    : '0';

  // ── Bin zone rows ─────────────────────────────────────────────────────────
  const normZones = (binAnalytics.zoneData ?? []).map((z: any) => ({
    zone:   z.zone,
    count:  z.total ?? 0,
    high:   z.highPriority   ?? 0,
    medium: z.mediumPriority ?? 0,
    low:    z.lowPriority    ?? 0,
  }));
  const grandTotal = normZones.reduce((s, z) => s + z.count, 0) || 1;
  const zoneRows   = normZones.map(z => ({
    ...z,
    pct: ((z.count / grandTotal) * 100).toFixed(1),
  }));

  // ── Zone collection chart data ─────────────────────────────────────────────
  const zoneCollectionData = (zoneCollection ?? []).map(z => ({
    zone:      z.zone,
    collected: z.collected,
  }));

  // ── Vehicle type cards ────────────────────────────────────────────────────
  const vehicleTypeData = Object.entries(vehicleTypeSnapshot ?? {}).map(([name, value]) => ({ name, value }));

  return (
    <>
      {/* Overlay */}
      <div
        className="no-print"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 9998, display: 'flex', alignItems: 'flex-start',
          justifyContent: 'center', padding: '24px 16px', overflowY: 'auto',
        }}
      >
        {/* Action bar */}
        <div style={{ position: 'fixed', top: 16, right: 24, zIndex: 10000, display: 'flex', gap: 10 }}>
          <button
            onClick={handlePrint}
            style={{
              background: '#16a34a', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 22px', fontWeight: 600,
              cursor: 'pointer', fontSize: 14,
            }}
          >
            🖨 Print / Save PDF
          </button>
          <button
            onClick={onClose}
            style={{
              background: '#fff', color: '#374151', border: '1px solid #d1d5db',
              borderRadius: 8, padding: '10px 18px', fontWeight: 600,
              cursor: 'pointer', fontSize: 14,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Report paper */}
        <div
          id="garbo-print-root"
          ref={printRef}
          style={{
            background: '#fff', width: '100%', maxWidth: 860,
            borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            padding: '48px 56px', fontFamily: "'Georgia', serif",
            color: '#111827', marginTop: 60,
          }}
        >

          {/* Cover header */}
          <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '3px solid #16a34a', paddingBottom: 28 }}>
            <div style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>
              Garbo Waste Management
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', margin: '0 0 6px' }}>
              Monthly Analytics Report
            </h1>
            <div style={{ fontSize: 15, color: '#6b7280' }}>{snapshot.periodLabel}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
              Generated: {new Date(snapshot.generatedAt).toLocaleString()} &nbsp;|&nbsp; Report #{reportId}
            </div>
          </div>

          {/* ── 1. COLLECTION OVERVIEW ──────────────────────────────────────── */}
          <SectionTitle>1. Collection Overview</SectionTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Assigned"        value={collection.assigned} />
            <KpiCard label="Collected"       value={collection.collected} />
            <KpiCard label="Missed"          value={collection.missed} />
            <KpiCard label="Collection Rate" value={`${collectionRate}%`} />
          </div>

          {collection.chartData?.length > 0 && (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={collection.chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="collected" fill="#16a34a" name="Collected" radius={[3, 3, 0, 0]} />
                <Bar dataKey="missed"    fill="#ef4444" name="Missed"    radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* ── 1b. COLLECTION BY ZONE ──────────────────────────────────────── */}
          {zoneCollectionData.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginTop: 24, marginBottom: 12 }}>
                Collection by Zone — Monthly Summary
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={zoneCollectionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="zone"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="collected" name="Collected" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}

          {/* ── 2. BIN ANALYTICS ────────────────────────────────────────────── */}
          <SectionTitle>2. Bin Analytics</SectionTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Total Bins" value={grandTotal} />
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 8 }}>
            <thead>
              <tr style={{ background: '#f0fdf4' }}>
                {['Zone', 'High Priority', 'Medium Priority', 'Low Priority', 'Total Bins', '% of Total'].map(h => (
                  <th
                    key={h}
                    style={{
                      padding: '8px 10px',
                      textAlign: h === 'Zone' ? 'left' : 'right',
                      fontWeight: 600, color: '#166534',
                      borderBottom: '2px solid #bbf7d0', whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zoneRows.map((z, i) => (
                <tr key={z.zone} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 600, color: ZONE_COLORS[i % ZONE_COLORS.length] }}>{z.zone}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{z.high}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{z.medium}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#374151' }}>{z.low}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>{z.count}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: '#6b7280' }}>{z.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── 3. COMPLAINTS ───────────────────────────────────────────────── */}
          <SectionTitle>3. Complaints</SectionTitle>
          {(() => {
            const s = complaints?.summary ?? {};
            return (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <KpiCard label="Pending"        value={s.pendingCount    ?? s.newCount        ?? 0} />
                <KpiCard label="Accepted"       value={s.acceptedCount   ?? s.resolvedCount   ?? 0} />
                <KpiCard label="Resolution %"   value={`${s.resolutionRate ?? 0}%`} />
              </div>
            );
          })()}

          {/* ── 4. STAFF OVERVIEW ───────────────────────────────────────────── */}
          <SectionTitle>4. Staff Overview</SectionTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <KpiCard label="Total Staff"     value={staff?.summary?.totalStaff  ?? 0} />
            <KpiCard label="On Duty"         value={staff?.summary?.onDutyCount ?? 0} />
            <KpiCard label="Attendance Rate" value={`${staff?.summary?.attendanceRate ?? 0}%`} />
          </div>

          {/* ── 5. THIRD-PARTY ──────────────────────────────────────────────── */}
          <SectionTitle>5. Third-Party Collection Requests</SectionTitle>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <KpiCard label="Total Requests"  value={thirdParty?.totalRequests  ?? 0} />
            <KpiCard label="Completion Rate" value={`${thirdParty?.completionRate ?? 0}%`} />
          </div>

          {/* ── 6. FLEET OVERVIEW ───────────────────────────────────────────── */}
          <SectionTitle>6. Fleet Overview</SectionTitle>
          {vehicleTypeData.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {vehicleTypeData.map(({ name, value }, i) => (
                <div
                  key={name}
                  style={{
                    background: '#f0fdf4',
                    border: `1px solid ${ZONE_COLORS[i % ZONE_COLORS.length]}`,
                    borderRadius: 8, padding: '14px 24px',
                    minWidth: 110, textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 28, fontWeight: 700, color: ZONE_COLORS[i % ZONE_COLORS.length] }}>{value}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{name}</div>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{
            marginTop: 48, borderTop: '1px solid #e5e7eb', paddingTop: 16,
            textAlign: 'center', fontSize: 11, color: '#9ca3af',
          }}>
            Garbo Waste Management System &nbsp;|&nbsp; Auto-generated report &nbsp;|&nbsp; {snapshot.periodLabel}
          </div>

        </div>
      </div>
    </>
  );
}