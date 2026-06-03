'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Trash2, Users, Truck, Loader2, AlertCircle, Briefcase, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
// Zone-level waste collection aggregates for the bar chart.
interface ZonePoint {
  zone: string;
  collected: number;
}

// Daily bin collection summary: assigned, collected, missed counts.
interface DaySummary {
  assigned: number;
  collected: number;
  missed: number;
}

// Staff attendance and on-duty status snapshot.
interface StaffSummary {
  onDutyCount: number;
  attendanceRate: number;
}

// Citizen complaints today with resolution rate.
interface ComplaintSummary {
  newCount: number;
  resolutionRate: number;
}

// Third-party collector requests and completion rate.
interface ThirdPartySummary {
  totalRequests: number;
  completionRate: number;
}

// Bin reports and affected bins recorded today.
interface BinReportSummary {
  totalReportsToday: number;
  affectedBinsToday: number;
}

// Fleet status snapshot: total, on route, available, maintenance.
interface VehicleSummary {
  totalFleet: number;
  onRoute: number;
  available: number;
  maintenance: number;
}

// Total bins deployed across all zones.
interface BinSummary {
  totalBins: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

// Safely extract council id/name for API query parameters.
const getCouncilParam = (council?: { id?: string; name?: string } | null) => {
  const rawValue = council?.id || council?.name;
  return rawValue ? rawValue.trim() : '';
};

export function WasteAnalytics({
  onNavigate,
  council,
}: {
  onNavigate?: (page: string) => void;
  council?: { id?: string; name?: string } | null;
}) {

  // Zone-collection chart state with time-window filter.
  const [zoneFilter, setZoneFilter] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [zoneData, setZoneData]     = useState<ZonePoint[]>([]);
  const [zoneLoading, setZoneLoading] = useState(true);

  // Independent data-fetch states for each KPI metric group.
  const [summary, setSummary]                   = useState<DaySummary | null>(null);
  const [staffSummary, setStaffSummary]         = useState<StaffSummary | null>(null);
  const [complaintSummary, setComplaintSummary] = useState<ComplaintSummary | null>(null);
  const [thirdPartySummary, setThirdPartySummary] = useState<ThirdPartySummary | null>(null);
  const [binReportSummary, setBinReportSummary] = useState<BinReportSummary | null>(null);
  const [vehicleSummary, setVehicleSummary]     = useState<VehicleSummary | null>(null);
  const [binSummary, setBinSummary]             = useState<BinSummary | null>(null);

  const [loading, setLoading]               = useState(true);
  const [staffLoading, setStaffLoading]     = useState(true);
  const [complaintLoading, setComplaintLoading] = useState(true);
  const [thirdPartyLoading, setThirdPartyLoading] = useState(true);
  const [binReportLoading, setBinReportLoading]   = useState(true);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [binLoading, setBinLoading]         = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  // Fetch collection by zone with time filter; updates whenever filter or council changes.
  useEffect(() => {
    const fetchZoneData = async () => {
      setZoneLoading(true);
      try {
        const filterMap: Record<string, string> = {
          Daily: 'DAILY', Weekly: 'WEEKLY', Monthly: 'MONTHLY',
        };
        const url = new URL(`${BASE_URL}/api/admin/analytics/zone-collection`);
        url.searchParams.set('filter', filterMap[zoneFilter]);
        const councilParam = getCouncilParam(council);
        if (councilParam) url.searchParams.set('council', councilParam);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json: ZonePoint[] = await res.json();
        setZoneData(json);
      } catch (err: any) {
        console.error('Zone collection fetch failed:', err);
        setZoneData([]);
      } finally {
        setZoneLoading(false);
      }
    };
    fetchZoneData();
  }, [zoneFilter, council]);

  // Fetch daily bin collection totals (assigned, collected, missed).
  useEffect(() => {
    const fetchDaySummary = async () => {
      try {
        const url = new URL(`${BASE_URL}/api/admin/analytics`);
        url.searchParams.set('filter', 'DAY');
        const councilParam = getCouncilParam(council);
        if (councilParam) url.searchParams.set('council', councilParam);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setSummary({ assigned: json.assigned, collected: json.collected, missed: json.missed });
      } catch (err: any) {
        setError(err.message ?? 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    fetchDaySummary();
  }, [council]);

  // Fetch staff on-duty count and attendance rate.
  useEffect(() => {
    const fetchStaffSummary = async () => {
      try {
        const params = new URLSearchParams();
        const councilParam = getCouncilParam(council);
        if (councilParam) params.set('councilId', councilParam);

        const res = await fetch(`${BASE_URL}/api/admin/staffanalytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setStaffSummary({ onDutyCount: json.summary.onDutyCount, attendanceRate: json.summary.attendanceRate });
      } catch { } finally { setStaffLoading(false); }
    };
    fetchStaffSummary();
  }, [council]);

  // Fetch today's new complaints and their resolution rate.
  useEffect(() => {
    const fetchComplaintSummary = async () => {
      try {
        const params = new URLSearchParams();
        params.set('filter', 'TODAY');
        const councilParam = getCouncilParam(council);
        if (councilParam) params.set('councilId', councilParam);

        const res = await fetch(`${BASE_URL}/api/admin/complaintanalytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setComplaintSummary({ newCount: json.summary.newCount, resolutionRate: json.summary.resolutionRate });
      } catch { } finally { setComplaintLoading(false); }
    };
    fetchComplaintSummary();
  }, [council]);

  // Fetch last month's third-party collector metrics: total requests and completion rate.
  useEffect(() => {
    const fetchThirdPartySummary = async () => {
      try {
        const params = new URLSearchParams();
        params.set('period', 'LAST_MONTH');
        const councilParam = getCouncilParam(council);
        if (councilParam) params.set('councilId', councilParam);

        const res = await fetch(`${BASE_URL}/api/admin/thirdparty/analyze?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setThirdPartySummary({ totalRequests: json.totalRequests, completionRate: json.completionRate });
      } catch { } finally { setThirdPartyLoading(false); }
    };
    fetchThirdPartySummary();
  }, [council]);

  // Fetch today's bin reports and affected bins count.
  useEffect(() => {
    const fetchBinReportSummary = async () => {
      try {
        const url = new URL(`${BASE_URL}/api/admin/bin-reports/analytics`);
        if (council?.name) url.searchParams.set('council', council.name);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setBinReportSummary({ totalReportsToday: json.totalReportsToday, affectedBinsToday: json.affectedBinsToday });
      } catch { } finally { setBinReportLoading(false); }
    };
    fetchBinReportSummary();
  }, [council?.name]);

  // Fetch fleet status: total, on route, available, and maintenance.
  useEffect(() => {
    const fetchVehicleSummary = async () => {
      try {
        const params = new URLSearchParams();
        const councilParam = getCouncilParam(council);
        if (councilParam) params.set('councilId', councilParam);

        const res = await fetch(`${BASE_URL}/api/admin/vehicles/analytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setVehicleSummary({ totalFleet: json.totalFleet, onRoute: json.onRoute, available: json.available, maintenance: json.maintenance });
      } catch { } finally { setVehicleLoading(false); }
    };
    fetchVehicleSummary();
  }, [council?.name]);

  // Fetch total bins deployed across all zones.
  useEffect(() => {
    const fetchBinSummary = async () => {
      try {
        const params = new URLSearchParams();
        const councilParam = getCouncilParam(council);
        if (councilParam) params.set('councilId', councilParam);

        const res = await fetch(`${BASE_URL}/api/admin/bin-analytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setBinSummary({ totalBins: json.totalBins });
      } catch { } finally { setBinLoading(false); }
    };
    fetchBinSummary();
  }, []);

  // Derived KPI: daily collection rate as percentage.
  const collectionRate = summary && summary.assigned > 0
    ? Math.round((summary.collected / summary.assigned) * 100)
    : 0;

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Waste Analytics</h1>
          <p className="text-gray-500 text-lg">Detailed insights and trends from waste collection operations</p>
        </div>
        <Button onClick={() => onNavigate?.('reports')} className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors rounded-lg px-4 py-2 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          View Report
        </Button>
      </div>

      {/* KPI Cards Row 1 */}
      {/* Top-level metrics: collection totals, bins on site, staff status, complaints. */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">

        {/* Total Collected */}
        <Card
          className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-blue-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate?.('total-collection')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Collected</CardTitle>
            <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors shadow-sm">
              <Trash2 className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : error ? (
              <div className="text-sm text-red-500 py-1">{error}</div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                  {summary?.collected ?? 0}
                  <span className="text-base font-medium text-gray-500 ml-1">bins</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {collectionRate}% rate
                  </span>
                  <span className="text-gray-500">today</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bins Onsite */}
        <Card
          className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-green-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate?.('bin-analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Bins Onsite</CardTitle>
            <div className="p-2.5 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors shadow-sm">
              <Trash2 className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            {binLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                  {binSummary?.totalBins ?? 0}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Active
                  </span>
                  <span className="text-gray-500">across all zones</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Collecting Staff */}
        <Card
          className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-emerald-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate?.('staff-analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Collecting Staff</CardTitle>
            <div className="p-2.5 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors shadow-sm">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            {staffLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                  {staffSummary?.onDutyCount ?? 0}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {staffSummary?.attendanceRate ?? 0}%
                  </span>
                  <span className="text-gray-500">active today</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Complaints */}
        <Card
          className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-red-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate?.('complaint-analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Complaints</CardTitle>
            <div className="p-2.5 bg-red-50 rounded-xl group-hover:bg-red-100 transition-colors shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            {complaintLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                  {complaintSummary?.newCount ?? 0}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 text-red-700 font-medium bg-red-100 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {complaintSummary?.resolutionRate ?? 0}%
                  </span>
                  <span className="text-gray-500">resolution rate</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards Row 2 */}
      {/* Secondary metrics: third-party completions, vehicle fleet status, bin reports. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

        {/* Third Party */}
        <Card
          className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-indigo-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate?.('third-party-analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Third Party Collectors</CardTitle>
            <div className="p-2.5 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors shadow-sm">
              <Briefcase className="w-5 h-5 text-indigo-600" />
            </div>
          </CardHeader>
          <CardContent>
            {thirdPartyLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                  {thirdPartySummary?.totalRequests.toLocaleString() ?? 0}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 text-indigo-700 font-medium bg-indigo-100 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {thirdPartySummary?.completionRate ?? 0}%
                  </span>
                  <span className="text-gray-500">last month</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Bin Reports */}
        <Card
          className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-teal-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate?.('bin-report-analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Bin Reports</CardTitle>
            <div className="p-2.5 bg-teal-50 rounded-xl group-hover:bg-teal-100 transition-colors shadow-sm">
              <FileText className="w-5 h-5 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent>
            {binReportLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                  {binReportSummary?.totalReportsToday ?? 0}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 text-teal-700 font-medium bg-teal-100 px-2 py-0.5 rounded-full">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {binReportSummary?.affectedBinsToday ?? 0}
                  </span>
                  <span className="text-gray-500">affected bins today</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Performance */}
        <Card
          className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-none bg-gradient-to-br from-white to-amber-50/30 shadow-md ring-1 ring-gray-100 relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate?.('vehicle-analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Vehicle Performance</CardTitle>
            <div className="p-2.5 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors shadow-sm">
              <Truck className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            {vehicleLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-end mb-3">
                  <div className="text-3xl font-bold text-gray-900 tracking-tight">
                    {vehicleSummary && vehicleSummary.totalFleet > 0
                      ? Math.round((vehicleSummary.onRoute / vehicleSummary.totalFleet) * 100)
                      : 0}%
                  </div>
                  <div className="text-lg font-semibold text-green-600">
                    {vehicleSummary && vehicleSummary.totalFleet > 0
                      ? Math.round((vehicleSummary.available / vehicleSummary.totalFleet) * 100)
                      : 0}%
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs mb-4">
                  <span className="text-gray-500 font-medium uppercase tracking-wider">Active</span>
                  <span className="text-gray-500 font-medium uppercase tracking-wider">Available</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Zone Collection Chart */}
      {/* Bar chart showing bins collected by zone across the selected time window. */}
      <div className="grid grid-cols-1 gap-6">
        <Card className="shadow-sm border border-gray-100 overflow-hidden">
          <CardHeader className="border-b border-gray-50 bg-gray-50/30 pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
              <div>
                <CardTitle className="text-lg font-semibold text-gray-800">Collection by Zone</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Distribution of total waste collected across municipal zones ({zoneFilter.toLowerCase()})
                </p>
              </div>
              <div className="flex bg-gray-100/50 p-1 rounded-lg border border-gray-200/50">
                {(['Daily', 'Weekly', 'Monthly'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setZoneFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                      zoneFilter === f
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {zoneLoading ? (
              <div className="flex items-center justify-center h-[350px]">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : zoneData.length === 0 ? (
              <div className="flex items-center justify-center h-[350px] text-gray-400 text-sm">
                No data available for the selected period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={zoneData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="zone" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} dx={-10} />
                  <Tooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      padding: '12px',
                    }}
                  />
                  <Bar dataKey="collected" fill="url(#colorCollected)" name="Bins Collected" radius={[6, 6, 0, 0]} barSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}