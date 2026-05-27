'use client';

// Admin page for creating, viewing, and deleting council waste bins.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Trash2, MapPin, AlertTriangle, Search, Plus, Loader2, Pencil, X, Check } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { toast } from "sonner";
import { ViewModeToggle } from './ViewModeToggle';
import { useAdminViewMode } from '../lib/useAdminViewMode';
import type { MapFocusBin } from '../lib/mapFocus';

const API_BASE = `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081'}/api/bins`;
const BIN_TYPES = ['General Waste', 'Recyclables', 'Organic Waste', 'Mixed Waste'];

// Shape of a bin record from the backend API
interface Bin {
  id: number;
  binCode?: string;            // Council-prefixed code, e.g. "Colombo-1"
  binId?: string;              // Legacy identifier
  location: string;            // Coordinates or address
  fillLevel: number;           // 0–100 percent full
  status: string;              // empty, half, full, or notChecked
  lastCollectionAt?: string;
  batteryLevel?: number;       // IoT sensor battery, if present
  coordinates: string;
  type?: string;               // Waste type, e.g. General Waste
  zone?: string;
  isAssigned?: boolean;        // On an active collection route
  council?: string;
}

// Main bin management screen for council admins
export function BinManagement({
  council,
  userRole,
  onAddBinOnMap,   // Navigates to map tab in add-bin mode
  onViewBinOnMap,  // Navigates to map tab and highlights a bin by location click
}: {
  council?: { name?: string } | null;
  userRole?: 'admin' | 'superadmin' | null;
  onAddBinOnMap?: () => void;
  onViewBinOnMap?: (bin: MapFocusBin & { location?: string; coordinates?: string }) => void;
}) {
  // --- Bin list data ---
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [councilFilterUnavailable, setCouncilFilterUnavailable] = useState(false);

  // --- Modals: edit and delete bin ---
  const [deletingBin, setDeletingBin] = useState<Bin | null>(null);
  const [editingBin, setEditingBin] = useState<Bin | null>(null);

  // --- Search, table/card toggle, and stat-card filter ---
  const [searchQuery, setSearchQuery] = useState("");
  const { viewMode, setViewMode } = useAdminViewMode();
  // Set when admin clicks a summary stat card to filter by fill status.
  const [statusFilter, setStatusFilter] = useState<'all' | 'full' | 'half' | 'empty'>('all');

  // Auth token for protected API calls
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Loads bin list from the backend, scoped to the active council
  const fetchBins = useCallback(async () => {
    try {
      setLoading(true);
      const query = council?.name ? `?council=${encodeURIComponent(council.name)}` : '';
      const response = await fetch(`${API_BASE}${query}`, { headers: authHeaders() });
      const result = await response.json();
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
  }, [council]);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  // Bins matching the search box (by code or location)
  const filteredBins = bins.filter(bin =>
    bin.binCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bin.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Row/table styling and card top-bar color by bin fill status.
  const getStatusRowStyles = (status: string) => {
    switch (status) {
      case 'full':
        return { row: 'bg-red-50 hover:bg-red-100/70', badge: 'bg-red-100 text-red-700', label: 'Full', bar: 'bg-red-500' };
      case 'half':
        return { row: 'bg-amber-50 hover:bg-amber-100/70', badge: 'bg-amber-100 text-amber-700', label: 'Half', bar: 'bg-amber-500' };
      case 'empty':
        return { row: 'bg-green-50 hover:bg-green-100/70', badge: 'bg-green-100 text-green-700', label: 'Empty', bar: 'bg-green-500' };
      default:
        return { row: 'bg-gray-50 hover:bg-gray-100/70', badge: 'bg-gray-100 text-gray-600', label: 'Not Checked', bar: 'bg-gray-400' };
    }
  };

  // Summary counts shown in the stats cards at the top
  const statsBins = useMemo(() => {
    if (!council?.name) return bins;
    const councilName = council.name.toLowerCase();
    return bins.filter((bin) => {
      if (typeof bin.council !== 'string') return true;
      return bin.council.toLowerCase() === councilName;
    });
  }, [bins, council]);

  const stats = useMemo(() => ({
    total: statsBins.length,
    full: statsBins.filter(b => b.status === 'full').length,
    half: statsBins.filter(b => b.status === 'half').length,
    empty: statsBins.filter(b => b.status === 'empty').length,
  }), [statsBins]);

  // Council-scoped bins sorted by bin code, with search + status filter
  const councilScopedBins = useMemo(() => {
    let list = filteredBins;
    if (council?.name) {
      const councilName = council.name.toLowerCase();
      list = filteredBins.filter((bin) => {
        if (typeof bin.council !== 'string') return true;
        return bin.council.toLowerCase() === councilName;
      });
    }
    if (statusFilter !== 'all') {
      list = list.filter((bin) => bin.status === statusFilter);
    }
    return [...list].sort((a, b) => {
      const codeA = a.binCode || `Bin #${a.id}`;
      const codeB = b.binCode || `Bin #${b.id}`;
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [filteredBins, council, statusFilter]);

  // Clicking the same stat card again clears the filter.
  const toggleStatusFilter = (filter: typeof statusFilter) => {
    setStatusFilter((current) => (current === filter ? 'all' : filter));
  };

  // Highlights the active stat card when a fill-status filter is applied.
  const statCardClass = (filter: typeof statusFilter) =>
    `bg-white cursor-pointer transition-all hover:shadow-md ${statusFilter === filter ? 'ring-2 ring-offset-2 ring-gray-900 shadow-md' : ''}`;

  // Human-readable label shown in the active filter banner.
  const statusFilterLabel = (filter: typeof statusFilter) => {
    switch (filter) {
      case 'full': return 'Full';
      case 'half': return 'Half';
      case 'empty': return 'Empty';
      default: return 'All';
    }
  };

  // Permanently removes the selected bin after confirmation
  const handleDelete = async () => {
    if (!deletingBin) return;
    try {
      const response = await fetch(`${API_BASE}/${deletingBin.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Bin deleted successfully");
        setDeletingBin(null);
        fetchBins();
      } else {
        toast.error(result.message || "Failed to delete bin");
      }
    } catch (error) {
      toast.error("Failed to delete bin");
    }
  };

  // Opens the map tab centered on this bin's coordinates.
  const handleViewOnMap = (bin: Bin) => {
    if (!onViewBinOnMap) return;
    if (!bin.location && !bin.coordinates) {
      toast.error('This bin has no location coordinates');
      return;
    }
    onViewBinOnMap({
      id: bin.id,
      binCode: bin.binCode,
      location: bin.location,
      coordinates: bin.coordinates,
    });
  };

  // Clickable location link — opens the map tab and highlights this bin.
  const BinLocationButton = ({ bin }: { bin: Bin }) => {
    if (!bin.location && !bin.coordinates) {
      return <span className="text-gray-400">—</span>;
    }
    return (
      <button
        type="button"
        onClick={() => handleViewOnMap(bin)}
        className="flex items-center gap-1.5 text-left text-blue-600 hover:text-blue-800 hover:underline transition-colors max-w-full"
        title="View on map"
      >
        <MapPin className="w-4 h-4 shrink-0" />
        <span className="truncate line-clamp-2">{bin.location || bin.coordinates}</span>
      </button>
    );
  };

  return (
    <div className="p-8">
      {/* Page header and Add Bin button (redirects to map) */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Bin Management</h2>
          <p className="text-gray-600">Monitor and manage all waste bins in real-time</p>
        </div>

        <button
          onClick={() => onAddBinOnMap?.()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Bin
        </button>
      </div>

      {/* Stats Summary — click to filter the list below */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className={statCardClass('all')} onClick={() => toggleStatusFilter('all')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Bins</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-full">
                <Trash2 className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={statCardClass('full')} onClick={() => toggleStatusFilter('full')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Full</p>
                <p className="text-2xl font-semibold text-red-600">
                  {stats.full}
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={statCardClass('half')} onClick={() => toggleStatusFilter('half')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Half</p>
                <p className="text-2xl font-semibold text-orange-600">
                  {stats.half}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-full">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={statCardClass('empty')} onClick={() => toggleStatusFilter('empty')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Empty</p>
                <p className="text-2xl font-semibold text-green-600">
                  {stats.empty}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-full">
                <Trash2 className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active stat-card filter banner */}
      {statusFilter !== 'all' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <span>
            Showing <strong>{statusFilterLabel(statusFilter)}</strong> bins only
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Search bar, council warning, and table/card toggle */}
      {councilFilterUnavailable && (
        <div className="mb-4 p-3 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 text-sm">
          Council-specific bin filtering is not available from backend data yet, so all bins are shown for this section.
        </div>
      )}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search bins by ID or location..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* Bins list — card grid or table; switches with ViewModeToggle */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-600">Loading bin data...</p>
        </div>
      ) : councilScopedBins.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            {statusFilter !== 'all' ? `No ${statusFilterLabel(statusFilter).toLowerCase()} bins found` : 'No bins found'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {statusFilter !== 'all' ? (
              <button type="button" onClick={() => setStatusFilter('all')} className="text-blue-600 hover:underline">
                Clear filter
              </button>
            ) : (
              'Start by adding a new waste bin to the system.'
            )}
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Card grid view */}
          {councilScopedBins.map((bin) => {
            const statusStyles = getStatusRowStyles(bin.status);
            return (
              <Card key={bin.id} className="bg-white border-none shadow-sm overflow-hidden">
                <div className={`h-1.5 ${statusStyles.bar}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="text-lg font-semibold text-gray-900">
                      {bin.binCode || `Bin #${bin.id}`}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusStyles.badge}`}>
                      {statusStyles.label}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700 mb-4">
                    <div className="flex items-start gap-1.5">
                      <BinLocationButton bin={bin} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <span className="font-medium">{bin.type || 'General Waste'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Route</span>
                      <Badge
                        className={
                          bin.isAssigned
                            ? 'bg-blue-100 text-blue-700 border-none'
                            : 'bg-white/70 text-gray-600 border-none'
                        }
                        variant="outline"
                      >
                        {bin.isAssigned ? 'Assigned' : 'Not Assigned'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => setEditingBin(bin)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit bin"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingBin(bin)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Delete bin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-white border-none shadow-sm overflow-hidden">
          {/* Table view */}
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Bin Code</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Location</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Type</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Route</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {councilScopedBins.map((bin) => {
                    const statusStyles = getStatusRowStyles(bin.status);
                    return (
                      <tr
                        key={bin.id}
                        className={`border-b border-white/60 transition-colors ${statusStyles.row}`}
                      >
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {bin.binCode || `Bin #${bin.id}`}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                          <BinLocationButton bin={bin} />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {bin.type || 'General Waste'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusStyles.badge}`}>
                            {statusStyles.label}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            className={
                              bin.isAssigned
                                ? 'bg-blue-100 text-blue-700 border-none'
                                : 'bg-white/70 text-gray-600 border-none'
                            }
                            variant="outline"
                          >
                            {bin.isAssigned ? 'Assigned' : 'Not Assigned'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditingBin(bin)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/60 rounded-lg transition-colors"
                              title="Edit bin"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingBin(bin)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-white/60 rounded-lg transition-colors"
                              title="Delete bin"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit bin modal (location, zone, waste type) */}
      {editingBin && (
        <BinFormModal
          bin={editingBin}
          onClose={() => setEditingBin(null)}
          onSaved={() => {
            setEditingBin(null);
            fetchBins();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingBin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg text-gray-900 mb-2">Delete Bin</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingBin.binCode || `Bin #${deletingBin.id}`}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingBin(null)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Edit bin form — matches vehicle edit modal pattern */
function BinFormModal({
  bin,
  onClose,
  onSaved,
}: {
  bin: Bin;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    location: bin.location || bin.coordinates || '',
    type: bin.type || BIN_TYPES[0],
    zone: bin.zone || '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Saves location, zone, and waste type changes for the selected bin.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location.trim()) {
      setFormError('Location is required');
      return;
    }
    if (!form.zone.trim()) {
      setFormError('Zone is required');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const response = await fetch(`${API_BASE}/${bin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          ...bin,
          location: form.location,
          zone: form.zone,
          type: form.type,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Bin updated successfully');
        onSaved();
      } else {
        setFormError(result.message || 'Failed to update bin');
      }
    } catch {
      setFormError('Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg text-gray-900">Edit Bin</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {formError && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Bin Code</label>
            <Input value={bin.binCode || `Bin #${bin.id}`} disabled className="bg-gray-50 text-gray-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Location (Coordinates) *</label>
              <Input
                placeholder="lat, lng"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Zone *</label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 1"
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Type *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {(bin.type && !BIN_TYPES.includes(bin.type)
                ? [bin.type, ...BIN_TYPES]
                : BIN_TYPES
              ).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : 'Update Bin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
