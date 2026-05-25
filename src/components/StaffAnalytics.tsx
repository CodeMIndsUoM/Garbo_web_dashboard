'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Users, UserCheck, UserMinus, Shield, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
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

// Top-line KPI values returned by the staff analytics endpoint.
interface StaffSummary {
  totalStaff:     number;
  onDutyCount:    number;
  onLeaveCount:   number;
  attendanceRate: number;
  avgPerformance: number;
}

// Zone-level distribution values used in the comparison chart.
interface ZoneStaff {
  zone:        string;
  staff:       number;
  performance: number;
}

// Full response shape consumed by this page.
interface StaffAnalyticsResponse {
  summary:  StaffSummary;
  zoneData: ZoneStaff[];
}

// Optional council scope used to filter analytics by municipality.
interface Council {
  id:           string;
  name:         string;
  description?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function StaffAnalytics({ onBack, council }: { onBack: () => void; council?: Council | null }) {

  // Component state for API payload, loading state, and request failures.
  const [data, setData]       = useState<StaffAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Fetch analytics whenever the selected council changes.
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (council?.name) params.set('councilId', council.name);

        const res = await fetch(`${BASE_URL}/api/admin/staffanalytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json: StaffAnalyticsResponse = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? 'Failed to load staff data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [council?.name]);

  // Safe defaults so the UI can render before data arrives.
  const s = data?.summary;
  const totalStaff     = s?.totalStaff     ?? 0;
  const onDutyCount    = s?.onDutyCount    ?? 0;
  const attendanceRate = s?.attendanceRate ?? 0;
  const zoneStaffData  = data?.zoneData    ?? [];

  return (
    <div className="p-8 bg-gray-50/30 min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-full shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Staff Analytics</h1>
            <p className="text-gray-500 text-lg">
              {council?.name
                ? `${council.name} — workforce distribution and attendance`
                : 'Monitoring workforce distribution and attendance'}
            </p>
          </div>
        </div>
      </div>

      {loading && (
        // Full-page spinner while the first analytics payload is loading.
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      )}

      {error && (
        // Non-blocking error banner; keeps previous UI structure visible.
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠️ {error}
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

            <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase">Total Workforce</CardTitle>
                <Users className="w-5 h-5 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{totalStaff}</div>
                <p className="text-sm text-gray-500 mt-1">Registered employees</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase">On Duty Today</CardTitle>
                <div className="p-2 bg-green-50 rounded-lg">
                  <UserCheck className="w-5 h-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{onDutyCount}</div>
                <p className="text-sm text-green-600 font-medium mt-1">{attendanceRate}% Attendance Rate</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase">Staff on Leave</CardTitle>
                <div className="p-2 bg-red-50 rounded-lg">
                  <UserMinus className="w-5 h-5 text-red-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{s?.onLeaveCount ?? 0}</div>
                <p className="text-sm text-red-600 font-medium mt-1">Requires coverage</p>
              </CardContent>
            </Card>

            <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-gray-500 uppercase">Avg Performance</CardTitle>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{s?.avgPerformance?.toFixed(1) ?? '0.0'}%</div>
                <p className="text-sm text-blue-600 font-medium mt-1">
                  {(s?.avgPerformance ?? 0) >= 90 ? 'Excellent efficiency' :
                   (s?.avgPerformance ?? 0) >= 75 ? 'Good efficiency' : 'Needs improvement'}
                </p>
              </CardContent>
            </Card>

          </div>

          {/* Zone Chart */}
          <div className="grid grid-cols-1 gap-6 mb-8">
            <Card className="border-none shadow-sm ring-1 ring-gray-100 bg-white">
              <CardHeader className="border-b border-gray-50 bg-gray-50/50">
                <CardTitle className="text-lg font-bold text-gray-800">
                  Staff Distribution & Performance by Zone
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Empty state protects chart from rendering with missing zone data. */}
                {zoneStaffData.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                    No zone data available
                  </div>
                ) : (
                  // Dual-bar chart compares staffing capacity vs. performance quality per zone.
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={zoneStaffData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="zone" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend />
                      <Bar dataKey="staff"       name="Staff Count"        fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={48} />
                      <Bar dataKey="performance" name="Performance Score %" fill="#10b981" radius={[4, 4, 0, 0]} barSize={48} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}