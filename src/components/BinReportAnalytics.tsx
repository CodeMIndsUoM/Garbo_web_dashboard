'use client';

import React, { useEffect, useState } from 'react';
import { FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  AnalyticsChartCard,
  AnalyticsErrorBanner,
  AnalyticsPageHeader,
  AnalyticsPageShell,
  AnalyticsSegmentFilter,
  AnalyticsStatCard,
  CHART,
} from './layout/analytics-ui';

interface HourlyCount {
  time: string;
  count: number;
}

interface DailyCount {
  day: string;
  count: number;
}

interface BinReportAnalyticsDTO {
  totalReportsToday: number;
  affectedBinsToday: number;
  uniqueReportersToday: number;
  reportFrequencyToday: HourlyCount[];
  reportFrequencyLastWeek: DailyCount[];
}

interface Council {
  id: string;
  name: string;
  description?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function BinReportAnalytics({
  onBack,
  council,
}: {
  onBack: () => void;
  council?: Council | null;
}) {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const [data, setData] = useState<BinReportAnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'TODAY' | 'WEEK'>('TODAY');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = new URL(`${API_BASE}/api/admin/bin-reports/analytics`);
        if (council?.name) url.searchParams.set('council', council.name);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json: BinReportAnalyticsDTO = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [council]);

  const todayData = data?.reportFrequencyToday ?? [];
  const weekData = data?.reportFrequencyLastWeek ?? [];

  return (
    <AnalyticsPageShell>
      <AnalyticsPageHeader
        title="Bin Reports"
        subtitle={`${council?.name ? `${council.name} — ` : ''}Citizen and sensor reports for ${today}`}
        onBack={onBack}
        actions={
          <AnalyticsSegmentFilter
            options={[
              { label: 'Today', value: 'TODAY' },
              { label: 'Last Week', value: 'WEEK' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        }
      />

      {error ? <AnalyticsErrorBanner message={`${error} — check that the backend is running on port 8081`} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <AnalyticsStatCard
          label="Total Reports Today"
          value={data?.totalReportsToday ?? 0}
          detail="Total submissions today"
          icon={FileText}
          loading={loading}
        />
        <AnalyticsStatCard
          label="Affected Bins"
          value={data?.affectedBinsToday ?? 0}
          detail="Unique bins reported"
          icon={AlertTriangle}
          loading={loading}
        />
        <AnalyticsStatCard
          label="No of Reporters"
          value={data?.uniqueReportersToday ?? 0}
          detail="Unique individuals"
          icon={CheckCircle2}
          loading={loading}
        />
      </div>

      <AnalyticsChartCard
        title="Report Frequency"
        subtitle={filter === 'TODAY' ? 'Hourly breakdown for today' : 'Daily breakdown for the last 7 days'}
      >
        {loading ? (
          <div className="h-[400px] animate-pulse rounded-lg bg-gray-100" />
        ) : filter === 'TODAY' ? (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={todayData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} dy={10} interval={1} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={CHART.tooltipStyle} formatter={(value: number) => [value, 'Reports']} />
              <Area
                type="monotone"
                dataKey="count"
                name="Reports"
                stroke={CHART.brand}
                fill={CHART.brand}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART.brand, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={weekData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 13 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} allowDecimals={false} />
              <Tooltip contentStyle={CHART.tooltipStyle} formatter={(value: number) => [value, 'Reports']} />
              <Bar dataKey="count" name="Reports" fill={CHART.brand} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </AnalyticsChartCard>
    </AnalyticsPageShell>
  );
}
