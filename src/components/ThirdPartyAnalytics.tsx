'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, CheckCircle2, Package, TrendingUp, Filter, Loader2, Calendar
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, PieChart, Pie
} from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'TODAY' | 'LAST_WEEK' | 'LAST_MONTH' | 'ALL';

interface AnalyticsData {
  totalRequests: number;
  completionRate: number;
  slotDistribution: Record<string, number>;
  statusSummary: Record<string, number>;
  wasteTypeBreakdown: Record<string, number>;
  filterPeriod: string;
}

// ── Colour palette (Curated HSL) ────────────────────────────────────────────────

const SLOT_COLORS: Record<string, string> = {
  MORNING:   '#f59e0b', // Amber
  AFTERNOON: '#3b82f6', // Blue
  EVENING:   '#8b5cf6', // Violet
};

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#10b981', // Emerald
  ASSIGNED:  '#3b82f6', // Blue
  CONFIRMED: '#f59e0b', // Amber
  OPEN:      '#64748b', // Slate
};

const WASTE_COLORS: Record<string, string> = {
  ORGANIC:  '#10b981',
  PLASTIC:  '#3b82f6',
  MIXED:    '#64748b',
  METAL:    '#f59e0b',
  GLASS:    '#06b6d4',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function toChartData(
  map: Record<string, number>,
  colors: Record<string, string>
) {
  return Object.entries(map).map(([name, value]) => ({
    name: name.charAt(0) + name.slice(1).toLowerCase(), 
    rawName: name,
    value,
    color: colors[name] ?? '#94a3b8',
  }));
}

// ── Custom Tooltip Component ───────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border-none ring-1 ring-gray-100 animate-in fade-in zoom-in duration-200">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label || payload[0].name}</p>
        <p className="text-lg font-bold text-gray-900">
          {payload[0].value.toLocaleString()} 
          <span className="text-sm font-medium text-gray-500 ml-1.5">requests</span>
        </p>
      </div>
    );
  }
  return null;
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ThirdPartyAnalytics({ onBack }: { onBack: () => void }) {
  const [period, setPeriod] = useState<Period>('ALL');
  const [data, setData]     = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/thirdparty/analyze?period=${p}`);
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
  }, []);

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  const slotChartData   = data ? toChartData(data.slotDistribution,  SLOT_COLORS)   : [];
  const statusChartData = data ? toChartData(data.statusSummary,      STATUS_COLORS) : [];
  const wasteChartData  = data ? toChartData(data.wasteTypeBreakdown, WASTE_COLORS)  : [];

  const periods: { label: string; value: Period }[] = [
    { label: 'Today',      value: 'TODAY'      },
    { label: 'Last 7 days', value: 'LAST_WEEK' },
    { label: 'Last 30 days', value: 'LAST_MONTH' },
    { label: 'All time',   value: 'ALL'        },
  ];

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50/30 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-gray-500 font-medium">Analyzing collection data...</p>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-5">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-full shadow-sm hover:bg-white transition-all hover:scale-105 active:scale-95 border-gray-200">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Third Party Collectors</h1>
            <p className="text-gray-500 text-lg">Monitoring external collection services and requests</p>
          </div>
        </div>

        {/* Period filter pills */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 shadow-md ring-1 ring-black/[0.03]">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                period === p.value
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-y-0'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <div className="p-1 bg-red-100 rounded-full">
            <Package className="w-4 h-4" />
          </div>
          {error}
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <Card className="border-none bg-gradient-to-br from-white to-blue-50/40 shadow-xl shadow-blue-900/[0.02] ring-1 ring-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-gray-400 uppercase tracking-widest">Total Requests</CardTitle>
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform duration-500">
              <Package className="w-5 h-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-gray-900 mb-2 tracking-tight">
              {data ? data.totalRequests.toLocaleString() : '—'}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-blue-700 font-bold bg-blue-100 px-2.5 py-1 rounded-full text-xs">
                <Calendar className="w-3.5 h-3.5" />
                {data ? data.filterPeriod.replace('_', ' ') : 'Analyzing...'}
              </span>
              <span className="text-gray-400 text-sm font-medium">Current view</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-white to-emerald-50/40 shadow-xl shadow-emerald-900/[0.02] ring-1 ring-gray-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold text-gray-400 uppercase tracking-widest">Completion Rate</CardTitle>
            <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform duration-500">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-gray-900 mb-2 tracking-tight">
              {data ? `${data.completionRate}%` : '—'}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100 px-2.5 py-1 rounded-full text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                Active
              </span>
              <span className="text-gray-400 text-sm font-medium">Service efficiency</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        {/* Preferred Slot — Donut */}
        <Card className="border-none shadow-xl shadow-gray-900/[0.02] ring-1 ring-gray-100 bg-white hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-lg font-bold text-gray-800">Preferred Collection Slots</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="h-[300px] w-full relative group">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slotChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={1500}
                  >
                    {slotChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} className="hover:opacity-80 transition-opacity cursor-pointer" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none group-hover:scale-110 transition-transform duration-500">
                <p className="text-3xl font-black text-gray-900">{data ? data.totalRequests : 0}</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Summary — Horizontal Bar */}
        <Card className="border-none shadow-xl shadow-gray-900/[0.02] ring-1 ring-gray-100 bg-white hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-lg font-bold text-gray-800">Request Status Summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusChartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} width={85} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32} animationDuration={1500}>
                  {statusChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} className="hover:opacity-80 transition-opacity" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Waste Type — Vertical Bar */}
        <Card className="border-none shadow-xl shadow-gray-900/[0.02] ring-1 ring-gray-100 bg-white hover:shadow-2xl transition-all duration-500">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30">
            <CardTitle className="text-lg font-bold text-gray-800">Waste Type Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={wasteChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={45} animationDuration={1500}>
                  {wasteChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} className="hover:opacity-80 transition-opacity" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}