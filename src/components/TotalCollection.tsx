import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, MapPin } from 'lucide-react';
import { getCouncilApiName } from '@/lib/council-context';
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

type FilterType = 'Day' | 'Last Week' | 'Last Month';

interface ChartPoint {
  time: string;
  assigned: number;
  collected: number;
  missed: number;
}

interface DashboardData {
  assigned: number;
  collected: number;
  missed: number;
  chartData: ChartPoint[];
}

interface Council {
  id: string;
  name: string;
  description?: string;
}

const FILTER_MAP: Record<FilterType, string> = {
  Day: 'DAY',
  'Last Week': 'WEEK',
  'Last Month': 'MONTH',
};

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function TotalCollection({
  onBack,
  council,
}: {
  onBack: () => void;
  council?: Council | null;
}) {
  const [filter, setFilter] = useState<FilterType>('Day');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const param = FILTER_MAP[filter];
        const url = new URL(`${BASE_URL}/api/admin/analytics`);
        url.searchParams.set('filter', param);
        const councilName = getCouncilApiName(council);
        if (councilName) url.searchParams.set('council', councilName);

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const json = await response.json();
        setData({
          assigned: json.assigned,
          collected: json.collected,
          missed: json.missed,
          chartData: json.chartData.map((point: ChartPoint) => ({
            time: point.time,
            assigned: point.assigned,
            collected: point.collected,
            missed: point.missed,
          })),
        });
      } catch (err: any) {
        setError(err.message ?? 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filter, council]);

  const collectionRate =
    data && data.assigned > 0 ? Math.round((data.collected / data.assigned) * 100) : 0;
  const missRate =
    data && data.assigned > 0 ? Math.round((data.missed / data.assigned) * 100) : 0;

  return (
    <AnalyticsPageShell>
      <AnalyticsPageHeader
        title="Total Collection"
        subtitle={`${council?.name ? `${council.name} — ` : ''}Detailed breakdown of bin collections`}
        onBack={onBack}
        actions={
          <AnalyticsSegmentFilter
            options={[
              { label: 'Day', value: 'Day' },
              { label: 'Last Week', value: 'Last Week' },
              { label: 'Last Month', value: 'Last Month' },
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
              label="Assigned Bins"
              value={data.assigned}
              detail="Total bins scheduled"
              icon={MapPin}
            />
            <AnalyticsStatCard
              label="Collected Bins"
              value={data.collected}
              detail={`${collectionRate}% collection rate`}
              icon={CheckCircle2}
            />
            <AnalyticsStatCard
              label="Missed Bins"
              value={data.missed}
              detail={`${missRate}% miss rate`}
              icon={AlertCircle}
            />
          </div>

          <AnalyticsChartCard title={`Collection Trends (${filter})`}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral }} />
                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={CHART.tooltipStyle} />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="assigned" name="Assigned" fill={CHART.neutral} radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill={CHART.brand} radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed" name="Missed" fill={CHART.alert} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </AnalyticsChartCard>
        </>
      ) : null}
    </AnalyticsPageShell>
  );
}
