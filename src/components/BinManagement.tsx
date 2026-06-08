'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, MapPin, CircleAlert, Gauge, CircleCheck, Search, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { PageHeader } from './layout/PageHeader';
import { StatCard, StatCardGrid, ViewModeToggle, type ViewMode } from './layout/management-ui';
import { AddBinGlassModal } from './bin/AddBinGlassModal';
import { toast } from "sonner";
import { apiFetch } from '@/lib/api';
import { useBinRealtime } from '@/hooks/useBinRealtime';
import { applyCollectionVisualUpdate, normalizeBinStatus } from '@/lib/bin-realtime';
import { BinReportDetailDialog, type BinReportDetail } from './bin/BinReportDetailDialog';

const BINS_API = '/api/bins';
const COUNCILS = [
  'Colombo',
  'Dehiwala-Mt. Lavinia',
  'Kaduwela',
  'Moratuwa',
  'Sri Jayewardenepura Kotte',
];

interface Bin {
  id: number;
  binCode: string;
  location: string;
  zone?: string;
  council?: string;
  fillLevel: number;
  status: string;
  coordinates: string;
  isAssigned?: boolean;
}

export function BinManagement({ council, userRole }: { council?: { name?: string } | null; userRole?: 'admin' | 'superadmin' | null }) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [councilFilterUnavailable, setCouncilFilterUnavailable] = useState(false);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const selectedBinRef = useRef<Bin | null>(null);
  const [selectedReport, setSelectedReport] = useState<BinReportDetail | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    selectedBinRef.current = selectedBin;
  }, [selectedBin]);
  
  // Form State
  const [newBin, setNewBin] = useState({
    binCode: '',
    location: '',
    type: 'General Waste',
    zone: '',
    status: 'empty',
    coordinates: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  const isAdmin = userRole === 'admin';
  const defaultCouncil = council?.name || '';
  const fetchBins = async () => {
    try {
      setLoading(true);
      const query = council?.name ? `?council=${encodeURIComponent(council.name)}` : '';
      const { response, data: result } = await apiFetch<{ success?: boolean; data?: Bin[] }>(
        `${BINS_API}${query}`
      );
      if (result.success) {
        const data = Array.isArray(result.data) ? result.data : [];
        const hasCouncilField = data.some((b: any) => typeof b?.council === 'string');
        setCouncilFilterUnavailable(Boolean(council?.name) && !hasCouncilField && data.length > 0);
        setBins(data);
      }
    } catch (error) {
      console.error("Error fetching bins:", error);
      toast.error("Failed to load bins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBins();
  }, [council?.name]);

  const loadLatestReport = async (bin: Bin) => {
    setReportLoading(true);
    try {
      const { data: result } = await apiFetch<{ success?: boolean; data?: BinReportDetail | null }>(
        `${BINS_API}/${bin.id}/latest-report`
      );
      if (result.success && result.data) {
        setSelectedReport(result.data);
      } else {
        setSelectedReport({
          binId: bin.id,
          binCode: bin.binCode,
          council: bin.council,
          status: bin.status,
          fillLevel: bin.fillLevel,
        });
      }
    } catch {
      toast.error('Failed to load report details');
      setSelectedReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  const openBinDetail = (bin: Bin) => {
    setSelectedBin(bin);
    setSelectedReport(null);
    void loadLatestReport(bin);
  };

  const closeBinDetail = () => {
    setSelectedBin(null);
    setSelectedReport(null);
    setReportLoading(false);
  };

  useBinRealtime({
    councilName: council?.name ?? null,
    onUpdate: (msg) => {
      const visual = applyCollectionVisualUpdate(msg);
      setBins((prev) => {
        const idx = prev.findIndex((b) => b.id === msg.binId);
        if (idx === -1) return prev;
        const next = [...prev];
        const current = next[idx];
        next[idx] = {
          ...current,
          status: visual.status ?? current.status,
          fillLevel: visual.fillLevel ?? current.fillLevel,
        };
        return next;
      });

      const activeBin = selectedBinRef.current;
      if (msg.type === 'BIN_STATUS_UPDATED' && activeBin?.id === msg.binId) {
        if (msg.changeType === 'STATUS_UNDONE') {
          setSelectedReport(null);
        } else if (msg.changeType === 'STATUS_REPORTED' || msg.changeType === 'REPORT_PHOTO_ATTACHED') {
          setSelectedReport((prev) => ({
            reportId: msg.reportId ?? prev?.reportId,
            binId: msg.binId,
            binCode: activeBin.binCode,
            council: activeBin.council,
            status: normalizeBinStatus(visual.status ?? activeBin.status),
            fillLevel: visual.fillLevel ?? activeBin.fillLevel,
            notes: msg.notes ?? prev?.notes ?? null,
            photoUrl: msg.photoUrl ?? prev?.photoUrl ?? null,
            reporterName: msg.reporterName ?? prev?.reporterName ?? null,
            reportedAt: msg.reportedAt ?? prev?.reportedAt ?? null,
          }));
        }
        setSelectedBin((prev) =>
          prev && prev.id === msg.binId
            ? {
                ...prev,
                status: visual.status ?? prev.status,
                fillLevel: visual.fillLevel ?? prev.fillLevel,
              }
            : prev
        );
      }

      if (msg.type === 'BIN_COLLECTED' && msg.collectionStatus) {
        toast.info(`Bin ${msg.binId}: ${msg.collectionStatus}`);
      }
    },
  });

  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isAdmin && !defaultCouncil) {
        toast.error("Your admin account has no council assigned");
        return;
      }

      const { zone: _zone, ...rest } = newBin;
      const binDataToSubmit = {
        ...rest,
        status: 'empty'
      };

      const { response, data: result } = await apiFetch<{ success?: boolean; message?: string; data?: { zone?: string } }>(
        BINS_API,
        { method: 'POST', body: JSON.stringify(binDataToSubmit) }
      );
      if (response.ok && result.success) {
        const assignedZone = result.data?.zone;
        toast.success(assignedZone ? `Bin created successfully (Zone ${assignedZone})` : "Bin created successfully");
        setIsCreateModalOpen(false);
        setNewBin({
          binCode: '',
          location: '',
          type: 'General Waste',
          zone: '',
          status: 'empty',
          coordinates: '',
          priority: 'medium',
        });
        fetchBins();
      } else {
        toast.error(result.message || "Failed to create bin");
      }
    } catch (error) {
      console.error("Error creating bin:", error);
      toast.error("Connection error");
    }
  };

  const handleDeleteBin = async (id: number) => {
    if (!confirm("Are you sure you want to delete this bin?")) return;
    try {
      const { data: result } = await apiFetch<{ success?: boolean }>(
        `${BINS_API}/${id}`,
        { method: 'DELETE' }
      );
      if (result.success) {
        toast.success("Bin deleted successfully");
        fetchBins();
      }
    } catch (error) {
      toast.error("Failed to delete bin");
    }
  };

  const normalizeStatus = (status: string) => normalizeBinStatus(status);

  const councilBins = useMemo(() => {
    if (!council?.name) return bins;
    const councilName = council.name.toLowerCase();
    return bins.filter((bin) => {
      if (typeof bin?.council !== 'string') return true;
      return bin.council.toLowerCase() === councilName;
    });
  }, [bins, council]);

  const binCounts = useMemo(
    () => ({
      total: councilBins.length,
      full: councilBins.filter((b) => normalizeStatus(b.status) === 'full').length,
      half: councilBins.filter((b) => normalizeStatus(b.status) === 'half').length,
      empty: councilBins.filter((b) => normalizeStatus(b.status) === 'empty').length,
    }),
    [councilBins]
  );

  const councilScopedBins = useMemo(() => {
    let result = councilBins;
    if (statusFilter) {
      result = result.filter((b) => normalizeStatus(b.status) === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (bin) =>
          bin.binCode?.toLowerCase().includes(q) ||
          bin.location?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [councilBins, statusFilter, searchQuery]);

  const handleStatusCardClick = (filter: string | null) => {
    setStatusFilter((prev) => (prev === filter ? null : filter));
  };

  const nextBinCode = useMemo(() => {
    if (!council?.name) return 'Auto-generated';
    const prefix = `${council.name.trim()}-`.toLowerCase();
    
    const maxNumber = councilBins.reduce((max, bin) => {
      const code = bin.binCode?.toLowerCase() || '';
      if (code.startsWith(prefix)) {
        const numStr = code.slice(prefix.length).trim();
        if (/^\d+$/.test(numStr)) {
          return Math.max(max, parseInt(numStr, 10));
        }
      }
      return max;
    }, 0);
    
    return `${council.name.trim()}-${maxNumber + 1}`;
  }, [council, councilBins]);



  const statusLabel = (status: string) => {
    const key = normalizeBinStatus(status);
    if (key === 'full') return 'Full';
    if (key === 'half') return 'Half';
    if (key === 'empty') return 'Empty';
    return 'Not Checked';
  };

  const statusBarClass = (status: string) => {
    const key = normalizeBinStatus(status);
    if (key === 'full') return 'bg-red-500';
    if (key === 'half') return 'bg-gray-400';
    if (key === 'empty') return 'bg-green-600';
    return 'bg-gray-200';
  };

  const statusTextClass = (status: string) => {
    const key = normalizeBinStatus(status);
    if (key === 'full') return 'text-red-600';
    return 'text-foreground';
  };

  return (
    <div className="p-8">
      <BinReportDetailDialog
        open={Boolean(selectedBin)}
        onClose={closeBinDetail}
        bin={selectedBin}
        report={selectedReport}
        loading={reportLoading}
      />
      <PageHeader
        title="Bin Management"
        subtitle="Monitor and manage all waste bins in real-time"
        actions={
          <Button type="button" variant="brand" className="gap-2" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="size-4" />
            Add New Bin
          </Button>
        }
      />
      <AddBinGlassModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        nextBinCode={nextBinCode}
        location={newBin.location}
        onLocationChange={(value) => setNewBin((p) => ({ ...p, location: value }))}
        priority={newBin.priority}
        onPriorityChange={(value) => setNewBin((p) => ({ ...p, priority: value }))}
        onSubmit={handleCreateBin}
      />

      <StatCardGrid columns={4} className="mb-8">
        <StatCard
          label="Total Bins"
          value={binCounts.total}
          icon={Trash2}
          active={statusFilter === null}
          onClick={() => handleStatusCardClick(null)}
        />
        <StatCard
          label="Full"
          value={binCounts.full}
          valueClassName="text-status-danger"
          icon={CircleAlert}
          iconClassName="text-status-danger/60"
          active={statusFilter === 'full'}
          onClick={() => handleStatusCardClick('full')}
        />
        <StatCard
          label="Half"
          value={binCounts.half}
          icon={Gauge}
          iconClassName="text-amber-400"
          active={statusFilter === 'half'}
          onClick={() => handleStatusCardClick('half')}
        />
        <StatCard
          label="Empty"
          value={binCounts.empty}
          icon={CircleCheck}
          iconClassName="text-brand-500"
          active={statusFilter === 'empty'}
          onClick={() => handleStatusCardClick('empty')}
        />
      </StatCardGrid>

      {/* Search and Filters */}
      {councilFilterUnavailable && (
        <div className="mb-4 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
          Council-specific bin filtering is not available from backend data yet, so all bins are shown for this section.
        </div>
      )}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bins by ID or location..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Bins */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
          <p className="text-muted-foreground">Loading bin data...</p>
        </div>
      ) : councilScopedBins.length === 0 ? (
        <div className="text-center py-20 bg-muted rounded-xl border-2 border-dashed border-border">
          <Trash2 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No bins found</p>
          <p className="text-sm text-muted-foreground mt-1">Start by adding a new waste bin to the system.</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/80 hover:bg-muted/80">
                <TableHead>Bin</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Fill status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {councilScopedBins.map((bin) => (
                <TableRow
                  key={bin.id}
                  className="cursor-pointer"
                  onClick={() => openBinDetail(bin)}
                >
                  <TableCell className="font-medium">{bin.binCode}</TableCell>
                  <TableCell className="max-w-[220px]">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{bin.location}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        bin.isAssigned
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-border bg-muted text-muted-foreground'
                      }
                    >
                      {bin.isAssigned ? 'Assigned' : 'Not Assigned'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`font-semibold ${statusTextClass(bin.status)}`}>
                      {statusLabel(bin.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBin(bin.id);
                        }}
                        className="p-1.5 text-muted-foreground hover:text-red-600"
                        aria-label="Delete bin"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {councilScopedBins.map((bin) => (
            <Card
              key={bin.id}
              className="hover:shadow-lg transition-all duration-300 border-border group overflow-hidden relative cursor-pointer"
              onClick={() => openBinDetail(bin)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openBinDetail(bin)}
            >
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${statusBarClass(bin.status)}`} />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-foreground font-semibold mb-1">{bin.binCode}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span className="line-clamp-1">{bin.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        bin.isAssigned
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-muted text-muted-foreground border-border'
                      }
                      variant="outline"
                    >
                      {bin.isAssigned ? 'Assigned' : 'Not Assigned'}
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBin(bin.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Fill Level */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-muted-foreground">Fill Status</span>
                      <span className={`text-sm font-bold ${statusTextClass(bin.status)}`}>
                        {statusLabel(bin.status)}
                      </span>
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
