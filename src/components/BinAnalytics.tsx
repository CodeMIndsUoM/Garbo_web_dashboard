'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
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
  empty:      '#10b981',
  half:       '#3b82f6',
  full:       '#ef4444',
  notChecked: '#94a3b8',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50/30">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <p className="text-gray-500 font-medium">Loading bin analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-gray-50/30 min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-full shadow-sm hover:bg-gray-100 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bin Analytics</h1>
            <p className="text-gray-500 text-lg">
              {council?.name
                ? `${council.name} — real-time bin monitoring across zones`
                : 'Detailed real-time monitoring of bin status across zones'}
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

        <Card className="border-none bg-white shadow-md ring-1 ring-gray-100 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Active Bins</CardTitle>
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <Trash2 className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900 mb-1">{totalBins}</div>
            <div className="text-sm text-green-600 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Operational
            </div>
          </CardContent>
        </Card>

        <Card className="border-none bg-gradient-to-br from-white to-red-50/30 shadow-md ring-1 ring-gray-100 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Urgent to Collect</CardTitle>
            <div className="p-2.5 bg-red-50 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 mb-1">{urgentBins}</div>
            <div className="text-sm text-red-500 font-medium">Full bins — immediate action needed</div>
          </CardContent>
        </Card>

      </div>

      {/* Bar Chart */}
      <Card className="border-none shadow-md ring-1 ring-gray-100 bg-white overflow-hidden mb-8">
        <CardHeader className="border-b border-gray-50 bg-gray-50/50">
          <CardTitle className="text-lg font-bold text-gray-800">Bin Status by Zone</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {zoneData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              No zone data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={zoneData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="zone" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="empty"      name="Empty"       stackId="a" fill={statusColors.empty}      />
                <Bar dataKey="half"       name="Half"        stackId="a" fill={statusColors.half}       />
                <Bar dataKey="full"       name="Full"        stackId="a" fill={statusColors.full}       />
                <Bar dataKey="notChecked" name="Not Checked" stackId="a" fill={statusColors.notChecked} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Priority Table */}
      <Card className="border-none shadow-md ring-1 ring-gray-100 bg-white overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/50">
          <CardTitle className="text-lg font-bold text-gray-800">Priority Breakdown by Zone</CardTitle>
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

    </div>
  );
}