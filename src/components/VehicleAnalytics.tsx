'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Truck, CheckCircle2, MapPin, Search, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────
interface VehicleRowDTO {
  vehicleId: string;
  plate: string;
  type: string;
  status: string;
}

interface VehicleAnalyticsDTO {
  totalFleet: number;
  onRoute: number;
  available: number;
  maintenance: number;
  vehicles: VehicleRowDTO[];
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function KpiSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-16 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-24 bg-gray-100 rounded" />
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

export function VehicleAnalytics({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<VehicleAnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${API_BASE}/api/admin/vehicles/analytics`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json: VehicleAnalyticsDTO = await res.json();
        setData(json);
      } catch (err: any) {
        console.error('Vehicle analytics fetch failed:', err);
        setError(err.message || 'Failed to load vehicle analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  // ── Client-side filter (search + status toggle) ───────────────────────────
  const filteredVehicles = (data?.vehicles ?? []).filter(v => {
    const matchesSearch =
      v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vehicleId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 bg-gray-50/30 min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack} className="rounded-full shadow-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Vehicle Analytics</h1>
            <p className="text-gray-500 text-lg">Monitoring fleet status and operational efficiency</p>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">

        <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase">Total Fleet</CardTitle>
            <Truck className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            {loading ? <KpiSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-gray-900">{data?.totalFleet ?? 0}</div>
                <p className="text-sm text-gray-500 font-medium mt-1">Active vehicles</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase">On Route</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <KpiSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-gray-900">{data?.onRoute ?? 0}</div>
                <p className="text-sm text-blue-600 font-medium mt-1">Currently active</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase">Available</CardTitle>
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <KpiSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-gray-900">{data?.available ?? 0}</div>
                <p className="text-sm text-green-600 font-medium mt-1">Ready for dispatch</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-white shadow-sm ring-1 ring-gray-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase">Maintenance</CardTitle>
            <div className="p-2 bg-amber-50 rounded-lg">
              <Settings className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <KpiSkeleton /> : (
              <>
                <div className="text-3xl font-bold text-gray-900">{data?.maintenance ?? 0}</div>
                <p className="text-sm text-amber-600 font-medium mt-1">In workshop</p>
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Fleet Table */}
      <Card className="border-none shadow-sm ring-1 ring-gray-100 bg-white overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold text-gray-800">Fleet Overview & Status</CardTitle>
            <div className="flex gap-2 mt-2">
              {['All', 'On Route', 'Available', 'Maintenance'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${statusFilter === s
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-500 hover:bg-gray-100 ring-1 ring-gray-200'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search plate or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {loading ? (
            <div className="animate-pulse space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-4 font-semibold text-gray-600 text-sm">Vehicle ID</th>
                    <th className="py-4 font-semibold text-gray-600 text-sm">Number Plate</th>
                    <th className="py-4 font-semibold text-gray-600 text-sm">Vehicle Type</th>
                    <th className="py-4 font-semibold text-gray-600 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                        No vehicles found
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((vehicle) => (
                      <tr key={vehicle.vehicleId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 text-sm font-medium text-blue-600">{vehicle.vehicleId}</td>
                        <td className="py-4 text-sm font-bold text-gray-900 tracking-wider">{vehicle.plate}</td>
                        <td className="py-4 text-sm text-gray-600 font-medium">{vehicle.type}</td>
                        <td className="py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${vehicle.status === 'On Route' ? 'bg-blue-50 text-blue-700' :
                            vehicle.status === 'Available' ? 'bg-green-50 text-green-700' :
                              vehicle.status === 'Maintenance' ? 'bg-amber-50 text-amber-700' :
                                'bg-gray-50 text-gray-700'
                            }`}>
                            {vehicle.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}