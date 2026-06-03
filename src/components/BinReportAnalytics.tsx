'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
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
  Cell,
} from 'recharts';

// Report count aggregated by hour for today's breakdown.
interface HourlyCount {
  time: string;
  count: number;
}

// Report count aggregated by day for the last 7 days.
interface DailyCount {
  day: string;
  count: number;
}

// Response model: today's metrics and historical frequency data for charts.
interface BinReportAnalyticsDTO {
  totalReportsToday: number;
  affectedBinsToday: number;
  uniqueReportersToday: number;
  reportFrequencyToday: HourlyCount[];
  reportFrequencyLastWeek: DailyCount[];
}

// Optional council scope to filter analytics by municipality.
interface Council {
  id: string;
  name: string;
  description?: string;
}

// Placeholder animation shown while KPI values load.
function KpiSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-16 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-32 bg-gray-100 rounded" />
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function BinReportAnalytics({
  onBack,
  council,
}: {
  onBack: () => void;
  council?: Council | null;
}) {
  // Format today's date for display in the subtitle.
  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  // Component state: analytics data from backend, loading/error flags, and chart filter toggle.
  const [data, setData]       = useState<BinReportAnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<'TODAY' | 'WEEK'>('TODAY');

  // Fetch bin report analytics on mount and whenever council changes.
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
        console.error('Analytics fetch failed:', err);
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [council]);

  // Extract chart data arrays; default to empty if not yet loaded.
  const todayData = data?.reportFrequencyToday    ?? [];
  const weekData  = data?.reportFrequencyLastWeek ?? [];

  return (
    <div className="p-8 bg-gray-50/30 min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-full shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bin Reports</h1>
            <p className="text-gray-500 text-lg">
              {council?.name ? `${council.name} — ` : ''}Detailed analysis of citizen and sensor reports for {today}
            </p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠ {error} — check that the backend is running on port 8081
        </div>
      )}

      {/* KPI Row */}
      {/* High-level metrics: total reports today, affected bins, unique reporters. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase">
              Total Reports Today
            </CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <KpiSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-gray-900">
                  {data?.totalReportsToday ?? 0}
                </div>
                <p className="text-sm text-blue-600 font-medium mt-1">Total submissions today</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase">
              Affected Bins
            </CardTitle>
            <div className="p-2 bg-amber-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <KpiSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-gray-900">
                  {data?.affectedBinsToday ?? 0}
                </div>
                <p className="text-sm text-amber-600 font-medium mt-1">Unique bins reported</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase">
              No of Reporters
            </CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <KpiSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-gray-900">
                  {data?.uniqueReportersToday ?? 0}
                </div>
                <p className="text-sm text-green-600 font-medium mt-1">Unique individuals</p>
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Chart Card */}
      {/* Time series visualization of report submissions with filter toggle between today and week views. */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <Card className="border-none shadow-sm ring-1 ring-gray-100 bg-white">

          <CardHeader className="border-b border-gray-50 bg-gray-50/50">
            <div className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-gray-800">
                  Report Frequency
                </CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  {filter === 'TODAY'
                    ? 'Hourly breakdown for today'
                    : 'Daily breakdown for the last 7 days'}
                </p>
              </div>
              {/* Toggle between today hourly view and last week daily view. */}
              <div className="flex gap-2">
                <Button
                  variant={filter === 'TODAY' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('TODAY')}
                  className="rounded-lg px-4"
                >
                  Today
                </Button>
                <Button
                  variant={filter === 'WEEK' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('WEEK')}
                  className="rounded-lg px-4"
                >
                  Last Week
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            {loading ? (
              <div className="animate-pulse h-[400px] bg-gray-100 rounded-lg" />
            ) : filter === 'TODAY' ? (
              // Area chart showing hourly report distribution for today.
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={todayData}>
                  <defs>
                    <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    dy={10}
                    interval={1}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [value, 'Reports']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Reports"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorReports)"
                    dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: '#3b82f6' }}
                  />
                </AreaChart>
              </ResponsiveContainer>

            ) : (
              // Bar chart showing daily report distribution for the last 7 days.
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={weekData} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 13 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [value, 'Reports']}
                    labelFormatter={(label) => `Day: ${label}`}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="count" name="Reports" radius={[6, 6, 0, 0]}>
                    {weekData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.day === 'Today' ? '#3b82f6' : '#bfdbfe'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}