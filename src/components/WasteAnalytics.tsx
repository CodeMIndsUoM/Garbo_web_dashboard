'use client';

import { useEffect, useState } from 'react';
import { Trash2, Users, Truck, AlertCircle, Briefcase, FileText, Loader2 } from 'lucide-react';
import {
  AnalyticsChartCard,
  AnalyticsPageHeader,
  AnalyticsSegmentFilter,
  AnalyticsStatCard,
  CHART,
} from './layout/analytics-ui';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AnalyticsDonutChart } from './layout/AnalyticsDonutChart';
import type { PieChartEntry } from './layout/analytics-ui';

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
  totalStaff: number;
  onDutyCount: number;
  onLeaveCount: number;
  attendanceRate: number;
}

interface ActivityPoint {
  time: string;
  collected: number;
  missed: number;
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

import { apiFetch, getApiBase } from '@/lib/api';

const BASE_URL = getApiBase();

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
  const [activityData, setActivityData]     = useState<ActivityPoint[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [citizenCount, setCitizenCount]     = useState(0);
  const [citizenLoading, setCitizenLoading] = useState(true);

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
        setActivityData(
          (json.chartData ?? []).map((point: ActivityPoint & { assigned?: number }) => ({
            time: point.time,
            collected: point.collected,
            missed: point.missed,
          }))
        );
      } catch (err: any) {
        setError(err.message ?? 'Failed to load');
      } finally {
        setLoading(false);
        setActivityLoading(false);
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
        setStaffSummary({
          totalStaff: json.summary.totalStaff,
          onDutyCount: json.summary.onDutyCount,
          onLeaveCount: json.summary.onLeaveCount,
          attendanceRate: json.summary.attendanceRate,
        });
      } catch { } finally { setStaffLoading(false); }
    };
    fetchStaffSummary();
  }, [council]);

  // External citizen count for users pie chart.
  useEffect(() => {
    const fetchCitizens = async () => {
      setCitizenLoading(true);
      try {
        const params = new URLSearchParams();
        const councilParam = getCouncilParam(council);
        if (councilParam) params.set('council', councilParam);

        const path = `/api/admin/citizens${params.toString() ? `?${params.toString()}` : ''}`;
        const { data: json } = await apiFetch<{ success?: boolean; data?: unknown[] } | unknown[]>(path);
        const list =
          json && typeof json === 'object' && 'data' in json && Array.isArray(json.data)
            ? json.data
            : Array.isArray(json)
              ? json
              : [];
        setCitizenCount(list.length);
      } catch {
        setCitizenCount(0);
      } finally {
        setCitizenLoading(false);
      }
    };
    fetchCitizens();
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
        setComplaintSummary({
          newCount: json.summary.pendingCount ?? json.summary.newCount ?? 0,
          resolutionRate: json.summary.resolutionRate,
        });
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
  }, [council]);

  // Derived KPI: daily collection rate as percentage.
  const collectionRate = summary && summary.assigned > 0
    ? Math.round((summary.collected / summary.assigned) * 100)
    : 0;

  const otherStaff = Math.max(
    0,
    (staffSummary?.totalStaff ?? 0) -
      (staffSummary?.onDutyCount ?? 0) -
      (staffSummary?.onLeaveCount ?? 0)
  );

  const usersPie: PieChartEntry[] = [
    { name: 'External Users', value: citizenCount, color: CHART.brand },
    { name: 'Staff On Duty', value: staffSummary?.onDutyCount ?? 0, color: '#22c55e' },
    { name: 'Staff On Leave', value: staffSummary?.onLeaveCount ?? 0, color: CHART.neutral },
    ...(otherStaff > 0
      ? [{ name: 'Other Staff', value: otherStaff, color: '#d1d5db' } as PieChartEntry]
      : []),
  ].filter((item) => item.value > 0);

  const fleetPie: PieChartEntry[] = [
    { name: 'On Route', value: vehicleSummary?.onRoute ?? 0, color: CHART.brand },
    { name: 'Available', value: vehicleSummary?.available ?? 0, color: '#22c55e' },
    { name: 'Maintenance', value: vehicleSummary?.maintenance ?? 0, color: CHART.neutral },
  ].filter((item) => item.value > 0);

  const totalUsers =
    citizenCount + (staffSummary?.totalStaff ?? 0);

  return (
    <div className="p-8">
      <AnalyticsPageHeader
        title="Dashboard"
        subtitle="Monitor your waste management operations in real-time"
        actions={
          <button
            type="button"
            onClick={() => onNavigate?.('reports')}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
          >
            <FileText className="w-4 h-4" />
            View Report
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <AnalyticsStatCard
          label="Total Collected"
          value={summary?.collected ?? 0}
          detail={`${collectionRate}% efficiency · ${summary?.assigned ?? 0} assigned · ${summary?.missed ?? 0} missed today`}
          icon={Trash2}
          loading={loading}
          error={error ?? undefined}
          onClick={() => onNavigate?.('total-collection')}
        />
        <AnalyticsStatCard
          label="Bins Onsite"
          value={binSummary?.totalBins ?? 0}
          detail="Active across all zones"
          icon={Trash2}
          loading={binLoading}
          onClick={() => onNavigate?.('bin-analytics')}
        />
        <AnalyticsStatCard
          label="Collecting Staff"
          value={staffSummary?.onDutyCount ?? 0}
          detail={`${staffSummary?.attendanceRate ?? 0}% active today`}
          icon={Users}
          loading={staffLoading}
          onClick={() => onNavigate?.('staff-analytics')}
        />
        <AnalyticsStatCard
          label="Complaints"
          value={complaintSummary?.newCount ?? 0}
          detail={`${complaintSummary?.resolutionRate ?? 0}% resolution rate`}
          icon={AlertCircle}
          loading={complaintLoading}
          onClick={() => onNavigate?.('complaint-analytics')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <AnalyticsStatCard
          label="Third Party Collectors"
          value={thirdPartySummary?.totalRequests.toLocaleString() ?? 0}
          detail={`${thirdPartySummary?.completionRate ?? 0}% last month`}
          icon={Briefcase}
          loading={thirdPartyLoading}
          onClick={() => onNavigate?.('third-party-analytics')}
        />
        <AnalyticsStatCard
          label="Bin Reports"
          value={binReportSummary?.totalReportsToday ?? 0}
          detail={`${binReportSummary?.affectedBinsToday ?? 0} affected bins today`}
          icon={FileText}
          loading={binReportLoading}
          onClick={() => onNavigate?.('bin-report-analytics')}
        />
        <AnalyticsStatCard
          label="Vehicle Performance"
          value={vehicleSummary?.onRoute ?? 0}
          detail={`${vehicleSummary?.available ?? 0} available · ${vehicleSummary?.totalFleet ?? 0} total fleet`}
          icon={Truck}
          loading={vehicleLoading}
          onClick={() => onNavigate?.('vehicle-analytics')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <AnalyticsChartCard
          title="System Users"
          subtitle="External citizens and internal staff breakdown"
        >
          {citizenLoading || staffLoading ? (
            <div className="flex h-[260px] items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <AnalyticsDonutChart
              data={usersPie}
              centerValue={totalUsers}
              centerLabel="Total users"
              height={260}
            />
          )}
        </AnalyticsChartCard>

        <AnalyticsChartCard
          title="Today's Field Activity"
          subtitle="Bins collected through the app today (hourly)"
        >
          {activityLoading ? (
            <div className="flex h-[260px] items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : activityData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center text-sm text-gray-400">
              No collection activity recorded today
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={activityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={CHART.tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="collected"
                  name="Collected"
                  stroke={CHART.brand}
                  fill={CHART.brand}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </AnalyticsChartCard>

        <AnalyticsChartCard
          title="Fleet Status"
          subtitle="Vehicles on route, available, and in maintenance"
        >
          {vehicleLoading ? (
            <div className="flex h-[260px] items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <AnalyticsDonutChart
              data={fleetPie}
              centerValue={vehicleSummary?.totalFleet ?? 0}
              centerLabel="Total fleet"
              height={260}
            />
          )}
        </AnalyticsChartCard>
      </div>

      <AnalyticsChartCard
        title="Collection by Zone"
        subtitle={`Distribution of total waste collected across municipal zones (${zoneFilter.toLowerCase()})`}
        actions={
          <AnalyticsSegmentFilter
            options={[
              { label: 'Daily', value: 'Daily' },
              { label: 'Weekly', value: 'Weekly' },
              { label: 'Monthly', value: 'Monthly' },
            ]}
            value={zoneFilter}
            onChange={setZoneFilter}
          />
        }
      >
        {zoneLoading ? (
          <div className="flex h-[300px] items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : zoneData.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
            No data available for the selected period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={zoneData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
              <XAxis dataKey="zone" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} dx={-10} />
              <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={CHART.tooltipStyle} />
              <Bar dataKey="collected" fill={CHART.brand} name="Bins Collected" radius={[6, 6, 0, 0]} barSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </AnalyticsChartCard>
    </div>
  );
}