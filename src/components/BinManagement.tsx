'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, MapPin, AlertTriangle, Search, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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

  const statCardClass = (active: boolean) =>
    `cursor-pointer transition-all hover:shadow-md ${
      active ? 'ring-2 ring-green-500 shadow-md' : ''
    }`;

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
    return 'text-gray-700';
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
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-gray-900 mb-2">Bin Management</h2>
          <p className="text-gray-600">Monitor and manage all waste bins in real-time</p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add New Bin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Waste Bin</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateBin} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Bin Code</label>
                <Input 
                  value={nextBinCode}
                  disabled
                  className="bg-gray-50 text-gray-500 font-semibold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Location (Coordinates)</label>
                <Input 
                  placeholder="lat, lng" 
                  value={newBin.location}
                  onChange={(e) => setNewBin({...newBin, location: e.target.value})}
                  required
                />
              </div>
              <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                Zone is assigned automatically from coordinates when you save.
              </p>

              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                Save Bin
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Summary — click a card to filter the grid below */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card
          className={statCardClass(statusFilter === null)}
          onClick={() => handleStatusCardClick(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleStatusCardClick(null)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Bins</p>
                <p className="text-2xl text-gray-900">{binCounts.total}</p>
              </div>
              <Trash2 className="w-10 h-10 shrink-0 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={statCardClass(statusFilter === 'full')}
          onClick={() => handleStatusCardClick('full')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleStatusCardClick('full')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Full</p>
                <p className="text-2xl text-red-600">{binCounts.full}</p>
              </div>
              <AlertTriangle className="w-10 h-10 shrink-0 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={statCardClass(statusFilter === 'half')}
          onClick={() => handleStatusCardClick('half')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleStatusCardClick('half')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Half</p>
                <p className="text-2xl text-gray-900">{binCounts.half}</p>
              </div>
              <AlertTriangle className="w-10 h-10 shrink-0 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={statCardClass(statusFilter === 'empty')}
          onClick={() => handleStatusCardClick('empty')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleStatusCardClick('empty')}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Empty</p>
                <p className="text-2xl text-gray-900">{binCounts.empty}</p>
              </div>
              <Trash2 className="w-10 h-10 shrink-0 text-gray-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      {councilFilterUnavailable && (
        <div className="mb-4 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
          Council-specific bin filtering is not available from backend data yet, so all bins are shown for this section.
        </div>
      )}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search bins by ID or location..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Bins Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-green-600 animate-spin mb-4" />
          <p className="text-gray-600">Loading bin data...</p>
        </div>
      ) : councilScopedBins.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No bins found</p>
          <p className="text-sm text-gray-400 mt-1">Start by adding a new waste bin to the system.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {councilScopedBins.map((bin) => (
            <Card
              key={bin.id}
              className="hover:shadow-lg transition-all duration-300 border-gray-100 group overflow-hidden relative cursor-pointer"
              onClick={() => openBinDetail(bin)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && openBinDetail(bin)}
            >
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${statusBarClass(bin.status)}`} />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-gray-900 font-semibold mb-1">{bin.binCode}</h3>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <MapPin className="w-4 h-4" />
                      <span className="line-clamp-1">{bin.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        bin.isAssigned
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
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
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Fill Level */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">Fill Status</span>
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
