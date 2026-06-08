import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, MapPin, Filter, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
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

const getCouncilParam = (council?: Council | null) => {
  const rawValue = council?.id || council?.name;
  return rawValue ? rawValue.trim() : '';
};

// ─── Filter → backend param map ───────────────────────────────────────────────
const FILTER_MAP: Record<FilterType, string> = {
  'Day':        'DAY',
  'Last Week':  'WEEK',
  'Last Month': 'MONTH',
};

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

// ─── Component ────────────────────────────────────────────────────────────────
export function TotalCollection({
  onBack,
  council,
}: {
  onBack: () => void;
  council?: Council | null;
}) {
  const [filter, setFilter]   = useState<FilterType>('Day');
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const param = FILTER_MAP[filter];
        const url   = new URL(`${BASE_URL}/api/admin/analytics`);
        url.searchParams.set('filter', param);
        const councilParam = getCouncilParam(council);
        if (councilParam) url.searchParams.set('council', councilParam);

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const json = await response.json();

        setData({
          assigned:  json.assigned,
          collected: json.collected,
          missed:    json.missed,
          chartData: json.chartData.map((point: any) => ({
            time:      point.time,
            assigned:  point.assigned,
            collected: point.collected,
            missed:    point.missed,
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

  // ─── Rates ──────────────────────────────────────────────────────────────────
  const collectionRate = data && data.assigned > 0
    ? Math.round((data.collected / data.assigned) * 100)
    : 0;

  const missRate = data && data.assigned > 0
    ? Math.round((data.missed / data.assigned) * 100)
    : 0;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-full shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Total Collection</h1>
            <p className="text-gray-500 text-lg">
              {council?.name ? `${council.name} — ` : ''}Detailed breakdown of bin collections
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 rounded-xl shadow-sm bg-white hover:bg-gray-50 transition-colors">
              <Filter className="h-4 w-4" />
              Filter: {filter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-white rounded-xl shadow-lg border-gray-100">
            {(['Day', 'Last Week', 'Last Month'] as FilterType[]).map((f) => (
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

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Content */}
      {!loading && data && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            {/* Assigned */}
            <Card className="border-none bg-gradient-to-br from-white to-blue-50/30 shadow-md ring-1 ring-gray-100 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Assigned Bins</CardTitle>
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900 mb-2">{data.assigned}</div>
                <p className="text-sm text-gray-500 font-medium">Total bins scheduled</p>
              </CardContent>
            </Card>

            {/* Collected */}
            <Card className="border-none bg-gradient-to-br from-white to-green-50/30 shadow-md ring-1 ring-gray-100 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Collected Bins</CardTitle>
                <div className="p-2.5 bg-green-50 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900 mb-2">{data.collected}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                    {collectionRate}% rate
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Missed */}
            <Card className="border-none bg-gradient-to-br from-white to-red-50/30 shadow-md ring-1 ring-gray-100 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Missed Bins</CardTitle>
                <div className="p-2.5 bg-red-50 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900 mb-2">{data.missed}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-700 font-medium bg-red-100 px-2 py-0.5 rounded-full">
                    {missRate}% rate
                  </span>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Chart */}
          <Card className="border-none shadow-md ring-1 ring-gray-100">
            <CardHeader>
              <CardTitle>Collection Trends ({filter})</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
                  <Tooltip
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="missed"    name="Missed"    fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

    </div>
  );
}