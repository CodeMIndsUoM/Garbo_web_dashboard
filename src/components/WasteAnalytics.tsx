'use client';

import { useEffect, useState, useMemo } from 'react';
import { Truck, Container, Users, CircleAlert, Briefcase, FileText, Loader2 } from 'lucide-react';
import { apiFetch, getApiBase } from '@/lib/api';
import { COUNCILS, getCouncilApiName } from '@/lib/council-context';
import {
  AnalyticsChartCard,
  AnalyticsSegmentFilter,
  CHART,
  CHART_ANIMATION,
  DashboardSection,
  type PieChartEntry,
} from './layout/analytics-ui';
import { PageHeader } from './layout/PageHeader';
import { StatCard, StatCardGrid } from './layout/management-ui';
import { Button } from './ui/button';
import { AnalyticsDonutChart } from './layout/AnalyticsDonutChart';
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
  Legend,
  Cell,
} from 'recharts';

const BASE_URL = getApiBase();

interface ZonePoint {
  zone: string;
  collected: number;
}

interface DaySummary {
  assigned: number;
  collected: number;
  missed: number;
}

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

interface ComplaintSummary {
  pendingCount: number;
  acceptedCount: number;
  resolutionRate: number;
}

interface ComplaintTrendPoint {
  label: string;
  pendingCount: number;
  acceptedCount: number;
}

interface ThirdPartySummary {
  totalRequests: number;
  completionRate: number;
}

interface BinReportSummary {
  totalReportsToday: number;
  affectedBinsToday: number;
}

interface VehicleSummary {
  totalFleet: number;
  onRoute: number;
  available: number;
  maintenance: number;
}

interface ZoneBinRow {
  empty: number;
  half: number;
  full: number;
  notChecked: number;
}

interface CouncilReportCount {
  council: string;
  weekCount: number;
  todayCount: number;
  isActive: boolean;
}

const formatActivityTime = (raw: string) => {
  if (!raw) return raw;
  const timePart = raw.includes(' ') ? raw.split(' ')[1] : raw;
  return timePart.length >= 5 ? timePart.slice(0, 5) : timePart;
};

const hasChartValues = (rows: { count?: number; collected?: number; pendingCount?: number; acceptedCount?: number }[]) =>
  rows.some(
    (row) =>
      (row.count ?? 0) > 0 ||
      (row.collected ?? 0) > 0 ||
      (row.pendingCount ?? 0) > 0 ||
      (row.acceptedCount ?? 0) > 0
  );

export function WasteAnalytics({
  onNavigate,
  council,
}: {
  onNavigate?: (page: string) => void;
  council?: { id?: string; name?: string } | null;
}) {
  const [zoneFilter, setZoneFilter] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
  const [zoneData, setZoneData] = useState<ZonePoint[]>([]);
  const [zoneLoading, setZoneLoading] = useState(true);

  const [summary, setSummary] = useState<DaySummary | null>(null);
  const [staffSummary, setStaffSummary] = useState<StaffSummary | null>(null);
  const [complaintSummary, setComplaintSummary] = useState<ComplaintSummary | null>(null);
  const [thirdPartySummary, setThirdPartySummary] = useState<ThirdPartySummary | null>(null);
  const [binReportSummary, setBinReportSummary] = useState<BinReportSummary | null>(null);
  const [vehicleSummary, setVehicleSummary] = useState<VehicleSummary | null>(null);
  const [totalBins, setTotalBins] = useState(0);
  const [urgentBins, setUrgentBins] = useState(0);
  const [binZoneRows, setBinZoneRows] = useState<ZoneBinRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [complaintLoading, setComplaintLoading] = useState(true);
  const [thirdPartyLoading, setThirdPartyLoading] = useState(true);
  const [binReportLoading, setBinReportLoading] = useState(true);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [binLoading, setBinLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activityData, setActivityData] = useState<ActivityPoint[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [citizenCount, setCitizenCount] = useState(0);
  const [citizenLoading, setCitizenLoading] = useState(true);
  const [complaintMonthTrend, setComplaintMonthTrend] = useState<ComplaintTrendPoint[]>([]);
  const [complaintChartLoading, setComplaintChartLoading] = useState(true);
  const [reportByCouncil, setReportByCouncil] = useState<CouncilReportCount[]>([]);

  useEffect(() => {
    const fetchZoneData = async () => {
      setZoneLoading(true);
      try {
        const filterMap: Record<string, string> = {
          Daily: 'DAILY',
          Weekly: 'WEEKLY',
          Monthly: 'MONTHLY',
        };
        const url = new URL(`${BASE_URL}/api/admin/analytics/zone-collection`);
        url.searchParams.set('filter', filterMap[zoneFilter]);
        const councilName = getCouncilApiName(council);
        if (councilName) url.searchParams.set('council', councilName);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const rows: ZonePoint[] = await res.json();
        setZoneData(rows);
      } catch {
        setZoneData([]);
      } finally {
        setZoneLoading(false);
      }
    };
    fetchZoneData();
  }, [zoneFilter, council]);

  useEffect(() => {
    const fetchDaySummary = async () => {
      try {
        const url = new URL(`${BASE_URL}/api/admin/analytics`);
        url.searchParams.set('filter', 'DAY');
        const councilName = getCouncilApiName(council);
        if (councilName) url.searchParams.set('council', councilName);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setSummary({ assigned: json.assigned, collected: json.collected, missed: json.missed });
        setActivityData(
          (json.chartData ?? []).map((point: ActivityPoint) => ({
            time: formatActivityTime(point.time),
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

  useEffect(() => {
    const fetchStaffSummary = async () => {
      try {
        const params = new URLSearchParams();
        const councilName = getCouncilApiName(council);
        if (councilName) params.set('councilId', councilName);

        const res = await fetch(`${BASE_URL}/api/admin/staffanalytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setStaffSummary({
          totalStaff: json.summary.totalStaff,
          onDutyCount: json.summary.onDutyCount,
          onLeaveCount: json.summary.onLeaveCount,
          attendanceRate: json.summary.attendanceRate,
        });
      } catch {
        /* ignore */
      } finally {
        setStaffLoading(false);
      }
    };
    fetchStaffSummary();
  }, [council]);

  useEffect(() => {
    const fetchCitizens = async () => {
      setCitizenLoading(true);
      try {
        const params = new URLSearchParams();
        const councilName = getCouncilApiName(council);
        if (councilName) params.set('council', councilName);

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

  useEffect(() => {
    const fetchComplaints = async () => {
      setComplaintLoading(true);
      setComplaintChartLoading(true);
      try {
        const councilName = getCouncilApiName(council);
        const baseParams = new URLSearchParams();
        if (councilName) baseParams.set('councilId', councilName);

        const todayParams = new URLSearchParams(baseParams);
        todayParams.set('filter', 'TODAY');
        const todayRes = await fetch(`${BASE_URL}/api/admin/complaintanalytics?${todayParams.toString()}`);
        if (todayRes.ok) {
          const todayJson = await todayRes.json();
          setComplaintSummary({
            pendingCount: todayJson.summary.pendingCount ?? todayJson.summary.newCount ?? 0,
            acceptedCount: todayJson.summary.acceptedCount ?? 0,
            resolutionRate: todayJson.summary.resolutionRate,
          });
        }

        const monthParams = new URLSearchParams(baseParams);
        monthParams.set('filter', 'MONTH');
        const monthRes = await fetch(`${BASE_URL}/api/admin/complaintanalytics?${monthParams.toString()}`);
        if (monthRes.ok) {
          const monthJson = await monthRes.json();
          setComplaintMonthTrend(monthJson.chartData ?? []);
        }
      } catch {
        /* ignore */
      } finally {
        setComplaintLoading(false);
        setComplaintChartLoading(false);
      }
    };
    fetchComplaints();
  }, [council]);

  useEffect(() => {
    const fetchThirdPartySummary = async () => {
      try {
        const params = new URLSearchParams();
        params.set('period', 'LAST_MONTH');
        const councilName = getCouncilApiName(council);
        if (councilName) params.set('councilId', councilName);

        const res = await fetch(`${BASE_URL}/api/admin/thirdparty/analyze?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setThirdPartySummary({ totalRequests: json.totalRequests, completionRate: json.completionRate });
      } catch {
        /* ignore */
      } finally {
        setThirdPartyLoading(false);
      }
    };
    fetchThirdPartySummary();
  }, [council]);

  useEffect(() => {
    const fetchBinReports = async () => {
      setBinReportLoading(true);
      try {
        const activeCouncilName = getCouncilApiName(council);

        const councilRows = await Promise.all(
          COUNCILS.map(async (entry) => {
            const url = new URL(`${BASE_URL}/api/admin/bin-reports/analytics`);
            url.searchParams.set('council', entry.name);
            const res = await fetch(url.toString());
            if (!res.ok) {
              return {
                council: entry.name,
                weekCount: 0,
                todayCount: 0,
                isActive: entry.name === activeCouncilName,
              };
            }
            const json = await res.json();
            const weekCount = (json.reportFrequencyLastWeek ?? []).reduce(
              (sum: number, row: { count: number }) => sum + (row.count ?? 0),
              0
            );
            return {
              council: entry.name,
              weekCount,
              todayCount: json.totalReportsToday ?? 0,
              isActive: entry.name === activeCouncilName,
            };
          })
        );

        councilRows.sort((a, b) => b.weekCount - a.weekCount);
        setReportByCouncil(councilRows);

        const scopedCouncil = activeCouncilName ?? councilRows.find((row) => row.weekCount > 0)?.council;
        if (scopedCouncil) {
          const activeRow = councilRows.find((row) => row.council === scopedCouncil);
          setBinReportSummary({
            totalReportsToday: activeRow?.todayCount ?? 0,
            affectedBinsToday: 0,
          });
        } else {
          const globalRes = await fetch(`${BASE_URL}/api/admin/bin-reports/analytics`);
          if (globalRes.ok) {
            const globalJson = await globalRes.json();
            setBinReportSummary({
              totalReportsToday: globalJson.totalReportsToday ?? 0,
              affectedBinsToday: globalJson.affectedBinsToday ?? 0,
            });
          }
        }
      } catch {
        setReportByCouncil([]);
      } finally {
        setBinReportLoading(false);
      }
    };
    fetchBinReports();
  }, [council]);

  useEffect(() => {
    const fetchVehicleSummary = async () => {
      try {
        const params = new URLSearchParams();
        const councilName = getCouncilApiName(council);
        if (councilName) params.set('councilId', councilName);

        const res = await fetch(`${BASE_URL}/api/admin/vehicles/analytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setVehicleSummary({
          totalFleet: json.totalFleet,
          onRoute: json.onRoute,
          available: json.available,
          maintenance: json.maintenance,
        });
      } catch {
        /* ignore */
      } finally {
        setVehicleLoading(false);
      }
    };
    fetchVehicleSummary();
  }, [council]);

  useEffect(() => {
    const fetchBinAnalytics = async () => {
      try {
        const params = new URLSearchParams();
        const councilName = getCouncilApiName(council);
        if (councilName) params.set('councilId', councilName);

        const res = await fetch(`${BASE_URL}/api/admin/bin-analytics?${params.toString()}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const json = await res.json();
        setTotalBins(json.totalBins ?? 0);
        setUrgentBins(json.urgentBins ?? 0);
        setBinZoneRows(json.zoneData ?? []);
      } catch {
        /* ignore */
      } finally {
        setBinLoading(false);
      }
    };
    fetchBinAnalytics();
  }, [council]);

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
    ...(otherStaff > 0 ? [{ name: 'Other Staff', value: otherStaff, color: '#d1d5db' }] : []),
  ].filter((item) => item.value > 0);

  const fleetPie: PieChartEntry[] = [
    { name: 'On Route', value: vehicleSummary?.onRoute ?? 0, color: CHART.brand },
    { name: 'Available', value: vehicleSummary?.available ?? 0, color: '#22c55e' },
    { name: 'Maintenance', value: vehicleSummary?.maintenance ?? 0, color: CHART.neutral },
  ].filter((item) => item.value > 0);

  const binHealthPie: PieChartEntry[] = useMemo(() => {
    const totals = binZoneRows.reduce(
      (acc, row) => {
        acc.empty += row.empty;
        acc.half += row.half;
        acc.full += row.full;
        acc.notChecked += row.notChecked;
        return acc;
      },
      { empty: 0, half: 0, full: 0, notChecked: 0 }
    );
    return [
      { name: 'Empty', value: totals.empty, color: CHART.brand },
      { name: 'Half', value: totals.half, color: '#22c55e' },
      { name: 'Full', value: totals.full, color: CHART.alert },
      { name: 'Not Checked', value: totals.notChecked, color: '#d1d5db' },
    ].filter((item) => item.value > 0);
  }, [binZoneRows]);

  const totalUsers = citizenCount + (staffSummary?.totalStaff ?? 0);
  const hasReportCouncilActivity = reportByCouncil.some((row) => row.weekCount > 0 || row.todayCount > 0);
  const hasComplaintActivity =
    (complaintSummary?.pendingCount ?? 0) > 0 ||
    (complaintSummary?.acceptedCount ?? 0) > 0 ||
    hasChartValues(complaintMonthTrend);

  const complaintStatusPie: PieChartEntry[] = [
    { name: 'Pending', value: complaintSummary?.pendingCount ?? 0, color: CHART.alert },
    { name: 'Resolved', value: complaintSummary?.acceptedCount ?? 0, color: CHART.brand },
  ].filter((item) => item.value > 0);

  const activeCouncilLabel = getCouncilApiName(council) ?? 'All councils';

  const chartLoader = (h = 260) => (
    <div className={`flex h-[${h}px] items-center justify-center`} style={{ height: h }}>
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="p-8">
      <PageHeader
        title="Dashboard"
        subtitle={
          council?.name
            ? `${council.name} — operations overview for council administrators`
            : 'Monitor waste collection, staff, fleet, and citizen services in real-time'
        }
        actions={
          <Button type="button" variant="brand" className="gap-2" onClick={() => onNavigate?.('reports')}>
            <FileText className="size-4" />
            View Report
          </Button>
        }
      />

      <DashboardSection title="Today's Operations" description="Key counts for collection, bins, complaints, and reports">
        <StatCardGrid columns={4}>
          <StatCard
            label="Collected Today"
            value={summary?.collected ?? 0}
            icon={Truck}
            iconClassName="text-brand-500"
            loading={loading}
            error={error ?? undefined}
            onClick={() => onNavigate?.('total-collection')}
          />
          <StatCard
            label="Bins Onsite"
            value={totalBins}
            valueClassName={urgentBins > 0 ? 'text-status-danger' : undefined}
            icon={Container}
            iconClassName={urgentBins > 0 ? 'text-status-danger/70' : 'text-brand-500'}
            loading={binLoading}
            onClick={() => onNavigate?.('bin-analytics')}
          />
          <StatCard
            label="Complaints"
            value={complaintSummary?.pendingCount ?? 0}
            valueClassName={(complaintSummary?.pendingCount ?? 0) > 0 ? 'text-status-danger' : undefined}
            icon={CircleAlert}
            iconClassName={
              (complaintSummary?.pendingCount ?? 0) > 0 ? 'text-status-danger/70' : 'text-muted-foreground'
            }
            loading={complaintLoading}
            onClick={() => onNavigate?.('complaint-analytics')}
          />
          <StatCard
            label="Bin Reports"
            value={binReportSummary?.totalReportsToday ?? 0}
            icon={FileText}
            iconClassName="text-muted-foreground"
            loading={binReportLoading}
            onClick={() => onNavigate?.('bin-report-analytics')}
          />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Resources" description="Staff, fleet, and third-party services">
        <StatCardGrid columns={3}>
          <StatCard
            label="Staff On Duty"
            value={staffSummary?.onDutyCount ?? 0}
            icon={Users}
            iconClassName="text-brand-500"
            loading={staffLoading}
            onClick={() => onNavigate?.('staff-analytics')}
          />
          <StatCard
            label="On Route"
            value={vehicleSummary?.onRoute ?? 0}
            valueClassName="text-status-info"
            icon={Truck}
            iconClassName="text-status-info/70"
            loading={vehicleLoading}
            onClick={() => onNavigate?.('vehicle-analytics')}
          />
          <StatCard
            label="Third Party"
            value={(thirdPartySummary?.totalRequests ?? 0).toLocaleString()}
            icon={Briefcase}
            iconClassName="text-muted-foreground"
            loading={thirdPartyLoading}
            onClick={() => onNavigate?.('third-party-analytics')}
          />
        </StatCardGrid>
      </DashboardSection>

      <DashboardSection title="Live Analytics" description="Animated charts from real-time system data">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:grid-rows-[auto_auto]">
          <AnalyticsChartCard
            className="xl:col-span-8 xl:row-start-1"
            title="Today's Field Activity"
            subtitle="Hourly bins collected via the mobile app"
          >
            {activityLoading ? (
              chartLoader(280)
            ) : activityData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                No collection activity recorded today
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={activityData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.brand} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART.brand} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 11 }} allowDecimals={false} domain={[0, 'auto']} />
                  <Tooltip contentStyle={CHART.tooltipStyle} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Collected"
                    stroke={CHART.brand}
                    fill="url(#activityGradient)"
                    strokeWidth={2.5}
                    {...CHART_ANIMATION}
                  />
                  <Area
                    type="monotone"
                    dataKey="missed"
                    name="Missed"
                    stroke={CHART.alert}
                    fill={CHART.alert}
                    fillOpacity={0.08}
                    strokeWidth={2}
                    {...CHART_ANIMATION}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>

          <div className="flex flex-col gap-6 xl:col-span-4 xl:row-span-2 xl:row-start-1">
            <AnalyticsChartCard title="System Users" subtitle="Citizens and staff in this council">
              {citizenLoading || staffLoading ? chartLoader(180) : (
                <AnalyticsDonutChart data={usersPie} centerValue={totalUsers} centerLabel="Total users" height={180} />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title="Bin Fill Status" subtitle="Empty, half, full, and unchecked bins">
              {binLoading ? chartLoader(180) : (
                <AnalyticsDonutChart data={binHealthPie} centerValue={totalBins} centerLabel="Total bins" height={180} />
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard title="Fleet Status" subtitle="On route, available, and maintenance">
              {vehicleLoading ? chartLoader(180) : (
                <AnalyticsDonutChart
                  data={fleetPie}
                  centerValue={vehicleSummary?.totalFleet ?? 0}
                  centerLabel="Total fleet"
                  height={180}
                />
              )}
            </AnalyticsChartCard>
          </div>

          <AnalyticsChartCard
            className="xl:col-span-8 xl:row-start-2"
            title="Collection by Zone"
            subtitle={`Waste collected per zone (${zoneFilter.toLowerCase()})`}
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
              chartLoader(280)
            ) : zoneData.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                No zone data for this period — try Weekly or Monthly
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={zoneData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                  <XAxis dataKey="zone" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 12 }} allowDecimals={false} domain={[0, 'auto']} />
                  <Tooltip cursor={{ fill: CHART.cursor }} contentStyle={CHART.tooltipStyle} />
                  <Bar
                    dataKey="collected"
                    fill={CHART.brand}
                    name="Bins Collected"
                    radius={[8, 8, 0, 0]}
                    barSize={44}
                    minPointSize={4}
                    {...CHART_ANIMATION}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AnalyticsChartCard
            title="Complaint Overview"
            subtitle={`${activeCouncilLabel} — today's status and 30-day trend`}
          >
            {complaintChartLoading ? (
              chartLoader(280)
            ) : !hasComplaintActivity ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                No complaints recorded for this council
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-center">
                    <p className="text-xs text-red-700">Pending</p>
                    <p className="text-lg font-semibold text-red-900">{complaintSummary?.pendingCount ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-center">
                    <p className="text-xs text-green-700">Resolved</p>
                    <p className="text-lg font-semibold text-green-900">{complaintSummary?.acceptedCount ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted px-3 py-2 text-center">
                    <p className="text-xs text-muted-foreground">Resolution</p>
                    <p className="text-lg font-semibold text-foreground">{complaintSummary?.resolutionRate ?? 0}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  <div className="md:col-span-2">
                    {complaintStatusPie.length > 0 ? (
                      <AnalyticsDonutChart
                        data={complaintStatusPie}
                        centerValue={(complaintSummary?.pendingCount ?? 0) + (complaintSummary?.acceptedCount ?? 0)}
                        centerLabel="Today"
                        height={180}
                      />
                    ) : (
                      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                        No complaints today
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-3">
                    {complaintMonthTrend.length === 0 ? (
                      <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                        No monthly trend data
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={complaintMonthTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART.grid} />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 10 }} allowDecimals={false} domain={[0, 'auto']} />
                          <Tooltip contentStyle={CHART.tooltipStyle} />
                          <Legend />
                          <Bar dataKey="pendingCount" name="Pending" fill={CHART.alert} radius={[4, 4, 0, 0]} barSize={14} minPointSize={3} {...CHART_ANIMATION} />
                          <Bar dataKey="acceptedCount" name="Resolved" fill={CHART.brand} radius={[4, 4, 0, 0]} barSize={14} minPointSize={3} {...CHART_ANIMATION} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            )}
          </AnalyticsChartCard>

          <AnalyticsChartCard
            title="Bin Reports by Council"
            subtitle="Last 7 days — compare report volume across councils"
          >
            {binReportLoading ? (
              chartLoader(280)
            ) : reportByCouncil.length === 0 ? (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Unable to load bin report data
              </div>
            ) : !hasReportCouncilActivity ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                  No bin reports in the last 7 days across any council.
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={reportByCouncil} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART.grid} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 11 }} allowDecimals={false} domain={[0, 1]} />
                    <YAxis type="category" dataKey="council" width={120} axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 11 }} />
                    <Tooltip contentStyle={CHART.tooltipStyle} formatter={(value: number) => [value, 'Reports (7 days)']} />
                    <Bar dataKey="weekCount" name="Reports (7 days)" fill={CHART.neutral} radius={[0, 6, 6, 0]} barSize={18} {...CHART_ANIMATION} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={reportByCouncil} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART.grid} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 11 }} allowDecimals={false} domain={[0, 'auto']} />
                  <YAxis type="category" dataKey="council" width={120} axisLine={false} tickLine={false} tick={{ fill: CHART.neutral, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={CHART.tooltipStyle}
                    formatter={(value: number, _name, item) => {
                      const row = item.payload as CouncilReportCount;
                      return [`${value} this week · ${row.todayCount} today`, 'Reports'];
                    }}
                  />
                  <Bar dataKey="weekCount" name="Reports (7 days)" radius={[0, 6, 6, 0]} barSize={20} minPointSize={4} {...CHART_ANIMATION}>
                    {reportByCouncil.map((row) => (
                      <Cell
                        key={row.council}
                        fill={row.isActive ? CHART.brand : row.weekCount > 0 ? '#22c55e' : CHART.neutral}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </AnalyticsChartCard>
        </div>
      </DashboardSection>
    </div>
  );
}
