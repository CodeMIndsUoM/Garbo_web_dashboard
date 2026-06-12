'use client';

import React, { useEffect, useState } from 'react';
import { Users, UserCheck, UserMinus, Shield } from 'lucide-react';
import {
  AnalyticsChartCard,
  AnalyticsErrorBanner,
  AnalyticsLoadingBlock,
  AnalyticsPageHeader,
  AnalyticsPageShell,
  AnalyticsStatCard,
  CHART,
} from './layout/analytics-ui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Top-line KPI values returned by the staff analytics endpoint.
interface StaffSummary {
  totalStaff:     number;
  onDutyCount:    number;
  onLeaveCount:   number;
  attendanceRate: number;
  avgPerformance: number;
}

// Zone-level distribution values used in the comparison chart.
interface ZoneStaff {
  zone:        string;
  staff:       number;
  performance: number;
}

// Full response shape consumed by this page.
interface StaffAnalyticsResponse {
  summary:  StaffSummary;
  zoneData: ZoneStaff[];
}

// Optional council scope used to filter analytics by municipality.
interface Council {
  id:           string;
  name:         string;
  description?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function StaffAnalytics({ onBack, council }: { onBack: () => void; council?: Council | null }) {

  // Component state for API payload, loading state, and request failures.
  const [data, setData]       = useState<StaffAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Fetch analytics whenever the selected council changes.
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (council?.name) params.set('councilId', council.name);

        const res = await fetch(`${BASE_URL}/api/admin/staffanalytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json: StaffAnalyticsResponse = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load staff data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [council?.name]);

  // Safe defaults so the UI can render before data arrives.
  const s = data?.summary;
  const totalStaff     = s?.totalStaff     ?? 0;
  const onDutyCount    = s?.onDutyCount    ?? 0;
  const attendanceRate = s?.attendanceRate ?? 0;
  const zoneStaffData  = data?.zoneData    ?? [];

  return (
    <AnalyticsPageShell>
      <AnalyticsPageHeader
        title="Staff Analytics"
        subtitle={
          council?.name
            ? `${council.name} — workforce distribution and attendance`
            : 'Monitoring workforce distribution and attendance'
        }
        onBack={onBack}
      />

      {error ? <AnalyticsErrorBanner message={error} /> : null}
      {loading ? <AnalyticsLoadingBlock /> : null}

      {!loading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <AnalyticsStatCard label="Total Workforce" value={totalStaff} detail="Registered employees" icon={Users} />
            <AnalyticsStatCard
              label="On Duty Today"
              value={onDutyCount}
              detail={`${attendanceRate}% attendance rate`}
              icon={UserCheck}
            />
            <AnalyticsStatCard
              label="Staff on Leave"
              value={s?.onLeaveCount ?? 0}
              detail="Requires coverage"
              icon={UserMinus}
            />
            <AnalyticsStatCard
              label="Avg Performance"
              value={`${s?.avgPerformance?.toFixed(1) ?? '0.0'}%`}
              detail={
                (s?.avgPerformance ?? 0) >= 90
                  ? 'Excellent efficiency'
                  : (s?.avgPerformance ?? 0) >= 75
                    ? 'Good efficiency'
                    : 'Needs improvement'
              }
              icon={Shield}
            />
          </div>

          <AnalyticsChartCard title="Staff Distribution & Performance by Zone">
            {zoneStaffData.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-gray-400">
                No zone data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={zoneStaffData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="zone" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={CHART.tooltipStyle} />
                  <Legend />
                  <Bar dataKey="staff" name="Staff Count" fill={CHART.neutral} radius={[4, 4, 0, 0]} barSize={48} />
                  <Bar dataKey="performance" name="Performance Score %" fill={CHART.brand} radius={[4, 4, 0, 0]} barSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>
        </>
      ) : null}
    </AnalyticsPageShell>
  );
}