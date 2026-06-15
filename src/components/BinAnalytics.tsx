'use client';

import React, { useEffect, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  AnalyticsChartCard,
  AnalyticsErrorBanner,
  AnalyticsPageHeader,
  AnalyticsPageShell,
  AnalyticsStatCard,
  CHART,
  type PieChartEntry,
} from './layout/analytics-ui';
import { AnalyticsDonutChart } from './layout/AnalyticsDonutChart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

interface Council {
  id:           string;
  name:         string;
  description?: string;
}

interface ZoneData {
  zone:           string;
  total:          number;
  empty:          number;
  half:           number;
  full:           number;
  notChecked:     number;
  highPriority:   number;
  mediumPriority: number;
  lowPriority:    number;
}

const statusColors = {
  empty: CHART.brand,
  half: '#FACC15',
  full: CHART.alert,
  notChecked: '#d1d5db',
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function BinAnalytics({
  onBack,
  onNavigate,
  council,
}: {
  onBack: () => void;
  onNavigate?: (page: string) => void;
  council?: Council | null;
}) {
  const [zoneData, setZoneData]     = useState<ZoneData[]>([]);
  const [totalBins, setTotalBins]   = useState(0);
  const [urgentBins, setUrgentBins] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (council?.name) params.set('councilId', council.name);

    fetch(`${API_BASE}/api/admin/bin-analytics?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        setZoneData(data.zoneData   || []);
        setTotalBins(data.totalBins || 0);
        setUrgentBins(data.urgentBins || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching bin analytics:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [council?.name]);

  const fillStatusPie: PieChartEntry[] = zoneData.reduce(
    (acc, zone) => {
      acc[0].value += zone.empty;
      acc[1].value += zone.half;
      acc[2].value += zone.full;
      acc[3].value += zone.notChecked;
      return acc;
    },
    [
      { name: 'Empty', value: 0, color: CHART.brand },
      { name: 'Half', value: 0, color: CHART.neutral },
      { name: 'Full', value: 0, color: CHART.alert },
      { name: 'Not Checked', value: 0, color: '#d1d5db' },
    ] as PieChartEntry[]
  ).filter((item) => item.value > 0);

  if (loading) {
    return (
      <AnalyticsPageShell>
        <AnalyticsPageHeader
          title="Bin Analytics"
          subtitle={
            council?.name
              ? `${council.name} — real-time bin monitoring across zones`
              : 'Detailed real-time monitoring of bin status across zones'
          }
          onBack={onBack}
        />
        <div className="py-20 text-center text-sm text-gray-500">Loading bin analytics...</div>
      </AnalyticsPageShell>
    );
  }

  return (
    <AnalyticsPageShell>
      <AnalyticsPageHeader
        title="Bin Analytics"
        subtitle={
          council?.name
            ? `${council.name} — real-time bin monitoring across zones`
            : 'Detailed real-time monitoring of bin status across zones'
        }
        onBack={onBack}
      />

      {error ? <AnalyticsErrorBanner message={error} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <AnalyticsStatCard
          label="Total Active Bins"
          value={totalBins}
          detail="Operational across all zones"
          icon={Trash2}
        />
        <AnalyticsStatCard
          label="Urgent to Collect"
          value={urgentBins}
          detail="Full bins need immediate action"
          icon={AlertTriangle}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <AnalyticsChartCard
          title="Fill Status Overview"
          subtitle="Council-wide bin status from zone data"
          className="lg:col-span-1"
        >
          <AnalyticsDonutChart
            data={fillStatusPie}
            centerValue={totalBins}
            centerLabel="Total bins"
            height={280}
          />
        </AnalyticsChartCard>

        <AnalyticsChartCard title="Bin Status by Zone" className="lg:col-span-2">
        {zoneData.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            No zone data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={zoneData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="zone" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 13 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 13 }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={CHART.tooltipStyle} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="empty" name="Empty" stackId="a" fill={statusColors.empty} />
              <Bar dataKey="half" name="Half" stackId="a" fill={statusColors.half} />
              <Bar dataKey="full" name="Full" stackId="a" fill={statusColors.full} />
              <Bar dataKey="notChecked" name="Not Checked" stackId="a" fill={statusColors.notChecked} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        </AnalyticsChartCard>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-gray-100 pb-4">
          <CardTitle className="text-gray-900">Priority Breakdown by Zone</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-4 font-semibold text-gray-600 text-sm">Zone</th>
                  <th className="py-4 font-semibold text-gray-600 text-sm">High Priority</th>
                  <th className="py-4 font-semibold text-gray-600 text-sm">Medium Priority</th>
                  <th className="py-4 font-semibold text-gray-600 text-sm">Low Priority</th>
                  <th className="py-4 font-semibold text-gray-600 text-sm">Total Bins</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {zoneData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-400 text-sm">
                      No data available
                    </td>
                  </tr>
                ) : (
                  zoneData.map((z) => (
                    <tr key={z.zone} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 font-medium text-gray-900">{z.zone}</td>
                      <td className="py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700">
                          {z.highPriority}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700">
                          {z.mediumPriority}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-green-50 text-green-700">
                          {z.lowPriority}
                        </span>
                      </td>
                      <td className="py-4 text-gray-600 font-medium">{z.total}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </AnalyticsPageShell>
  );
}