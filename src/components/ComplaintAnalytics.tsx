'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, MessageSquare, AlertCircle, Clock, CheckCircle2, Filter, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
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

// ─── Types ────────────────────────────────────────────────────────────────────
type FilterType = 'Today' | 'Week' | 'Month';

interface ComplaintSummary {
  newCount:        number;
  inProgressCount: number;
  resolvedCount:   number;
  resolutionRate:  number;
}

interface ComplaintChartPoint {
  label:      string;
  newCount:   number;
  inProgress: number;
  resolved:   number;
}

interface ComplaintAnalyticsResponse {
  period:    string;
  summary:   ComplaintSummary;
  chartData: ComplaintChartPoint[];
}

const FILTER_MAP: Record<FilterType, string> = {
  Today: 'TODAY',
  Week:  'WEEK',
  Month: 'MONTH',
};

const BASE_URL = 'http://localhost:8081';

export function ComplaintAnalytics({ onBack }: { onBack: () => void }) {

  const [filter, setFilter]   = useState<FilterType>('Today');
  const [data, setData]       = useState<ComplaintAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${BASE_URL}/api/admin/complaintanalytics?filter=${FILTER_MAP[filter]}`
        );
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
  }, [filter]);

  const s = data?.summary;

  return (
    <div className="p-8 bg-gray-50/30 min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-full shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Complaint Analytics</h1>
            <p className="text-gray-500 text-lg">Managing citizen feedback and service issues</p>
          </div>
        </div>

        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 rounded-xl shadow-sm bg-white hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              Filter: {filter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-white rounded-xl shadow-lg border-gray-100">
            {(['Today', 'Week', 'Month'] as FilterType[]).map((f) => (
              <DropdownMenuItem
                key={f}
                onClick={() => setFilter(f)}
                className="cursor-pointer rounded-lg hover:bg-gray-50"
              >
                {f}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Row — always today's numbers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase">New Complaints</CardTitle>
                <div className="p-2 bg-red-50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{s?.newCount ?? 0}</div>
                <p className="text-sm text-red-600 font-medium mt-1">Requires immediate attention</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase">In Progress</CardTitle>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{s?.inProgressCount ?? 0}</div>
                <p className="text-sm text-blue-600 font-medium mt-1">Under investigation</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase">Resolved Total</CardTitle>
                <div className="p-2 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{s?.resolvedCount ?? 0}</div>
                <p className="text-sm text-green-600 font-medium mt-1">
                  {s?.resolutionRate ?? 0}% resolution rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Area Chart */}
          <Card className="border-none shadow-sm ring-1 ring-gray-100 bg-white overflow-hidden">
            <CardHeader className="border-b border-gray-50 bg-gray-50/50">
              <div>
                <CardTitle className="text-lg font-bold text-gray-800">
                  Complaint History & Resolution Trends
                </CardTitle>
                <p className="text-sm text-gray-500">
                  {filter === 'Today'
                    ? "Today's complaint status breakdown"
                    : filter === 'Week'
                    ? 'Status distribution over the last 7 days'
                    : 'Status distribution over the last 30 days'}
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {data.chartData.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                  No complaint data for this period
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={450}>
                  <AreaChart
                    data={data.chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10b981" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #f1f5f9',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: '20px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="newCount"
                      name="New"
                      stroke="#ef4444"
                      fillOpacity={1}
                      fill="url(#colorNew)"
                      strokeWidth={3}
                    />
                    <Area
                      type="monotone"
                      dataKey="inProgress"
                      name="In Progress"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorProgress)"
                      strokeWidth={3}
                    />
                    <Area
                      type="monotone"
                      dataKey="resolved"
                      name="Resolved"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorResolved)"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}