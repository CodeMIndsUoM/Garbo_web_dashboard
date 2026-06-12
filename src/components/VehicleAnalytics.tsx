'use client';

import React, { useEffect, useState } from 'react';
import { Truck, CheckCircle2, MapPin, Search, Settings } from 'lucide-react';
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

// Individual vehicle record from the fleet inventory.
interface VehicleRowDTO {
  vehicleId: string;
  plate: string;
  type: string;
  status: string;
}

// Aggregated fleet metrics and the full vehicle list.
interface VehicleAnalyticsDTO {
  totalFleet: number;
  onRoute: number;
  available: number;
  maintenance: number;
  vehicles: VehicleRowDTO[];
}

// Optional council scope to filter analytics by municipality.
interface Council {
  id: string;
  name: string;
  description?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

export function VehicleAnalytics({ onBack, council }: { onBack: () => void; council?: Council | null }) {
  // Component state: fleet data, loading flags, and UI filters for the table.
  const [data, setData] = useState<VehicleAnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Fetch fleet analytics on mount and whenever council changes.
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (council?.name) params.set('councilId', council.name);

        const res = await fetch(`${API_BASE}/api/admin/vehicles/analytics?${params.toString()}`);
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
  }, [council?.name]);

  // Apply search and status filters to the vehicle list; shown in the table below.
  const filteredVehicles = (data?.vehicles ?? []).filter(v => {
    const matchesSearch =
      v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vehicleId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fleetPie: PieChartEntry[] = [
    { name: 'On Route', value: data?.onRoute ?? 0, color: CHART.brand },
    { name: 'Available', value: data?.available ?? 0, color: '#22c55e' },
    { name: 'Maintenance', value: data?.maintenance ?? 0, color: CHART.neutral },
  ].filter((item) => item.value > 0);

  return (
    <AnalyticsPageShell>
      <AnalyticsPageHeader
        title="Vehicle Analytics"
        subtitle={
          council?.name
            ? `${council.name} — fleet status and operational efficiency`
            : 'Monitoring fleet status and operational efficiency'
        }
        onBack={onBack}
      />

      {error ? <AnalyticsErrorBanner message={`${error} — check that the backend is running on port 8081`} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <AnalyticsStatCard
          label="Total Fleet"
          value={data?.totalFleet ?? 0}
          detail="Active vehicles"
          icon={Truck}
          loading={loading}
        />
        <AnalyticsStatCard
          label="On Route"
          value={data?.onRoute ?? 0}
          detail="Currently active"
          icon={MapPin}
          loading={loading}
        />
        <AnalyticsStatCard
          label="Available"
          value={data?.available ?? 0}
          detail="Ready for dispatch"
          icon={CheckCircle2}
          loading={loading}
        />
        <AnalyticsStatCard
          label="Maintenance"
          value={data?.maintenance ?? 0}
          detail="In workshop"
          icon={Settings}
          loading={loading}
        />
      </div>

      <AnalyticsChartCard
        title="Fleet Status Distribution"
        subtitle="Share of vehicles by operational status"
        className="mb-8"
      >
        <AnalyticsDonutChart
          data={fleetPie}
          centerValue={data?.totalFleet ?? 0}
          centerLabel="Total fleet"
          height={280}
        />
      </AnalyticsChartCard>

      {/* Fleet Table */}
      {/* Searchable, filterable inventory of all vehicles with status badges. */}
      <Card className="border-none shadow-sm ring-1 ring-gray-100 bg-white overflow-hidden">
        <CardHeader className="border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-gray-900">Fleet Overview & Status</CardTitle>
            {/* Quick-filter buttons for status grouping. */}
            <div className="flex gap-2 mt-2">
              {['All', 'On Route', 'Available', 'Maintenance'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${statusFilter === s
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 hover:bg-gray-100 ring-1 ring-gray-200'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {/* Search by plate number or vehicle ID. */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search plate or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Loading skeleton or rendered table with row-level status colors. */}
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
                  {/* Empty state when filters exclude all vehicles. */}
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400 text-sm">
                        No vehicles found
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((vehicle) => (
                      <tr key={vehicle.vehicleId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 text-sm font-medium text-gray-900">{vehicle.vehicleId}</td>
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

    </AnalyticsPageShell>
  );
}