'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, Package, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  AnalyticsChartCard,
  AnalyticsErrorBanner,
  AnalyticsPageHeader,
  AnalyticsPageShell,
  AnalyticsSegmentFilter,
  AnalyticsStatCard,
  CHART,
  mapRecordToPieData,
  formatStatusKey,
} from './layout/analytics-ui';
import { AnalyticsDonutChart } from './layout/AnalyticsDonutChart';

type Period = 'TODAY' | 'LAST_WEEK' | 'LAST_MONTH' | 'ALL';

interface AnalyticsData {
  totalRequests: number;
  completionRate: number;
  slotDistribution: Record<string, number>;
  statusSummary: Record<string, number>;
  wasteTypeBreakdown: Record<string, number>;
  filterPeriod: string;
}

interface Council {
  id: string;
  name: string;
  description?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function ThirdPartyAnalytics({ onBack, council }: { onBack: () => void; council?: Council | null }) {
  const [period, setPeriod] = useState<Period>('ALL');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (p: Period) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('period', p);
        if (council?.name) params.set('councilId', council.name);

        const res = await fetch(`${BASE_URL}/api/admin/thirdparty/analyze?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const json: AnalyticsData = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    [council?.name]
  );

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const slotChartData = mapRecordToPieData(data?.slotDistribution, formatStatusKey);
  const statusChartData = mapRecordToPieData(data?.statusSummary, formatStatusKey);
  const wasteChartData = mapRecordToPieData(data?.wasteTypeBreakdown, formatStatusKey);

  if (loading && !data) {
    return (
      <AnalyticsPageShell>
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Analyzing collection data...</p>
        </div>
      </AnalyticsPageShell>
    );
  }

  return (
    <AnalyticsPageShell>
      <AnalyticsPageHeader
        title="Third Party Collectors"
        subtitle={
          council?.name
            ? `${council.name} — external collection services and requests`
            : 'Monitoring external collection services and requests'
        }
        onBack={onBack}
        actions={
          <AnalyticsSegmentFilter
            options={[
              { label: 'Today', value: 'TODAY' },
              { label: 'Last 7 days', value: 'LAST_WEEK' },
              { label: 'Last 30 days', value: 'LAST_MONTH' },
              { label: 'All time', value: 'ALL' },
            ]}
            value={period}
            onChange={setPeriod}
          />
        }
      />

      {error ? <AnalyticsErrorBanner message={error} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <AnalyticsStatCard
          label="Total Requests"
          value={data?.totalRequests.toLocaleString() ?? 0}
          detail={data?.filterPeriod?.replace(/_/g, ' ') ?? 'Current view'}
          icon={Package}
          loading={loading}
        />
        <AnalyticsStatCard
          label="Completion Rate"
          value={`${data?.completionRate ?? 0}%`}
          detail="Service efficiency"
          icon={CheckCircle2}
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AnalyticsChartCard title="Preferred Collection Slots">
          <AnalyticsDonutChart
            data={slotChartData}
            centerValue={data?.totalRequests ?? 0}
            centerLabel="Total"
            height={280}
          />
        </AnalyticsChartCard>

        <AnalyticsChartCard title="Request Status Summary">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statusChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART.grid} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} width={90} />
              <Tooltip contentStyle={CHART.tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                {statusChartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>

        <AnalyticsChartCard title="Waste Type Breakdown">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={wasteChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} />
              <Tooltip contentStyle={CHART.tooltipStyle} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                {wasteChartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>
    </AnalyticsPageShell>
  );
}
