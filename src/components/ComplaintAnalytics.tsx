'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  AnalyticsChartCard,
  AnalyticsErrorBanner,
  AnalyticsLoadingBlock,
  AnalyticsPageHeader,
  AnalyticsPageShell,
  AnalyticsSegmentFilter,
  AnalyticsStatCard,
  CHART,
} from './layout/analytics-ui';

type FilterType = 'Today' | 'Week' | 'Month';

interface ComplaintSummary {
  pendingCount: number;
  acceptedCount: number;
  resolutionRate: number;
}

interface ComplaintChartPoint {
  label: string;
  pendingCount: number;
  acceptedCount: number;
}

interface ComplaintAnalyticsResponse {
  period: string;
  summary: ComplaintSummary;
  chartData: ComplaintChartPoint[];
}

interface Council {
  id: string;
  name: string;
  description?: string;
}

const FILTER_MAP: Record<FilterType, string> = {
  Today: 'TODAY',
  Week: 'WEEK',
  Month: 'MONTH',
};

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function ComplaintAnalytics({ onBack, council }: { onBack: () => void; council?: Council | null }) {
  const [filter, setFilter] = useState<FilterType>('Today');
  const [data, setData] = useState<ComplaintAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('filter', FILTER_MAP[filter]);
        if (council?.name) params.set('councilId', council.name);

        const res = await fetch(`${BASE_URL}/api/admin/complaintanalytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json: ComplaintAnalyticsResponse = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load complaint data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filter, council?.name]);

  const s = data?.summary;

  return (
    <AnalyticsPageShell>
      <AnalyticsPageHeader
        title="Complaint Analytics"
        subtitle={
          council?.name
            ? `${council.name} — citizen feedback and service issues`
            : 'Managing citizen feedback and service issues'
        }
        onBack={onBack}
        actions={
          <AnalyticsSegmentFilter
            options={[
              { label: 'Today', value: 'Today' },
              { label: 'Week', value: 'Week' },
              { label: 'Month', value: 'Month' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        }
      />

      {error ? <AnalyticsErrorBanner message={error} /> : null}
      {loading ? <AnalyticsLoadingBlock /> : null}

      {!loading && data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <AnalyticsStatCard
              label="New Complaints"
              value={s?.pendingCount ?? 0}
              detail="Requires immediate attention"
              icon={AlertCircle}
            />
            <AnalyticsStatCard
              label="Resolved Complaints"
              value={s?.acceptedCount ?? 0}
              detail="Successfully resolved"
              icon={CheckCircle2}
            />
            <AnalyticsStatCard
              label="Resolution Rate"
              value={`${s?.resolutionRate ?? 0}%`}
              detail="Accepted vs total for period"
              icon={TrendingUp}
            />
          </div>

          <AnalyticsChartCard
            title="Complaint History & Resolution Trends"
            subtitle={
              filter === 'Today'
                ? "Today's complaint status breakdown"
                : filter === 'Week'
                  ? 'Status distribution over the last 7 days'
                  : 'Status distribution over the last 30 days'
            }
          >
            {data.chartData.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-gray-400">
                No complaint data for this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} />
                  <Tooltip contentStyle={CHART.tooltipStyle} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                  <Area
                    type="monotone"
                    dataKey="pendingCount"
                    name="Pending"
                    stroke={CHART.alert}
                    fill={CHART.alert}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="acceptedCount"
                    name="Resolved"
                    stroke={CHART.brand}
                    fill={CHART.brand}
                    fillOpacity={0.12}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>
        </>
      ) : null}
    </AnalyticsPageShell>
  );
}
