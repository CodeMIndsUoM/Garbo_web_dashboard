'use client';

// Admin page for managing the waste collection fleet and driver assignments.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, MapPin, Wrench, Search, Plus, Pencil, X, Check, User, Trash2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ViewModeToggle } from './ViewModeToggle';
import { useAdminViewMode } from '../lib/useAdminViewMode';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

// A waste collection vehicle in the fleet
interface Vehicle {
  id: number;
  licensePlate: string;
  vehicleCode?: string;         // Optional fleet code; falls back to license plate in UI
  type: string;                 // Truck, Compactor, or Mini Truck
  capacity: number | null;      // Tons of waste
  status: string;               // available, on_route, or maintenance
  assignedCouncil: string;
  assignedDriverId: number | null;  // Bin collector staff ID
  assignedDriverName?: string | null;
  currentLocation: string;
  fuelLevel: number;
  isActive: boolean;
  lastMaintenanceAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Staff member who drives a collection vehicle
interface BinCollector {
  empId: number;
  empName?: string;
  email?: string;
  assignedCouncil?: string;
}

const COUNCILS = [
  'Colombo',
  'Dehiwala-Mt. Lavinia',
  'Kaduwela',
  'Moratuwa',
  'Sri Jayewardenepura Kotte',
];
const VEHICLE_TYPES = ['Truck', 'Compactor', 'Mini Truck'];

// Label for each vehicle status
function getStatusLabel(status: string) {
  switch (status) {
    case 'on_route': return 'On Route';
    case 'maintenance': return 'Maintenance';
    case 'inactive': return 'Inactive';
    default: return 'Available';
  }
}

// Row/table styling and card top-bar color by vehicle status.
function getStatusRowStyles(status: string) {
  switch (status) {
    case 'on_route':
      return { row: 'bg-blue-50 hover:bg-blue-100/70', badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' };
    case 'maintenance':
      return { row: 'bg-amber-50 hover:bg-amber-100/70', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' };
    case 'inactive':
      return { row: 'bg-gray-50 hover:bg-gray-100/70', badge: 'bg-gray-100 text-gray-600', bar: 'bg-gray-400' };
    default:
      return { row: 'bg-green-50 hover:bg-green-100/70', badge: 'bg-green-100 text-green-700', bar: 'bg-green-500' };
  }
}

// Main fleet management screen for council admins
export function VehicleManagement({ council, userRole }: { council?: { name?: string; id?: string } | null; userRole?: 'admin' | 'superadmin' | null }) {
  // --- Fleet data ---
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- Driver lookup (bin collectors assigned to vehicles) ---
  const [drivers, setDrivers] = useState<BinCollector[]>([]);
  const [allDrivers, setAllDrivers] = useState<BinCollector[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [showDriversListModal, setShowDriversListModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<BinCollector | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<BinCollector | null>(null);

  // --- Modals: create, edit, and delete vehicle ---
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  // --- List display: table/card toggle and stat-card filter ---
  const { viewMode, setViewMode } = useAdminViewMode();
  // Set when admin clicks a summary stat card to filter the vehicle list.
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'on_route' | 'maintenance'>('all');

  // Auth token for protected API calls
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Loads bin collector staff who can be assigned as drivers
  const fetchDrivers = useCallback(async () => {
    try {
      const councilQuery = council?.name ? `?council=${encodeURIComponent(council.name)}` : '';
      const url = `${API_BASE}/api/admins/staff${councilQuery}`;
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 401) {
        console.warn('Staff list requires login — driver names will use vehicle data only');
        return;
      }
      const json = await res.json();
      if (json.success) {
        const staff: any[] = Array.isArray(json.data) ? json.data : [];
        const collectors = staff.filter(s => (s.role || '').toString().toUpperCase() === 'BIN_COLLECTOR');
        setAllDrivers(collectors);
        
        if (council?.name) {
          const councilName = council.name.toLowerCase();
          setDrivers(collectors.filter((d) => (d.assignedCouncil || '').toLowerCase() === councilName));
        } else {
          setDrivers(collectors);
        }
      }
    } catch {
      console.error('Failed to fetch drivers (bin collectors)');
    } finally {
      setDriversLoading(false);
    }
  }, [council]);

  // Loads fleet vehicles, scoped to the active council
  const fetchVehicles = useCallback(async () => {
    try {
      const councilQuery = council?.name || council?.id || '';
      const url = `${API_BASE}/api/vehicles${councilQuery ? `?council=${encodeURIComponent(councilQuery)}` : ''}`;
      const res = await fetch(url, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        const rawVehicles: Vehicle[] = Array.isArray(json.data) ? json.data : [];
        if (council?.name) {
          const councilName = council.name.toLowerCase();
          setVehicles(rawVehicles.filter((v) => (v.assignedCouncil || '').toLowerCase() === councilName));
        } else {
          setVehicles(rawVehicles);
        }
      }
    } catch {
      console.error('Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  }, [council]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);
  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  // Quick lookup table: driver ID → driver record
  const driversById = useMemo(() => {
    const map = new Map<number, BinCollector>();
    for (const driver of allDrivers) map.set(driver.empId, driver);
    return map;
  }, [allDrivers]);

  // Display name for the driver assigned to a vehicle
  const getDriverLabel = useCallback((vehicle: Vehicle) => {
    const { assignedDriverId, assignedDriverName } = vehicle;
    if (!assignedDriverId) return 'Unassigned';
    if (assignedDriverName) return assignedDriverName;
    
    const driver = driversById.get(assignedDriverId);
    if (!driver) return `#${assignedDriverId}`;
    return driver.empName || `Staff #${assignedDriverId}`;
  }, [driversById]);

  // Refreshes driver list after an edit
  const handleDriverUpdated = () => {
    setEditingDriver(null);
    fetchDrivers();
  };

  // Vehicles matching search and optional status filter from stats cards
  const displayedVehicles = useMemo(() => {
    let list = vehicles.filter(v =>
      v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase())
    );
    if (statusFilter === 'available') {
      list = list.filter(v => v.status === 'available' || !['on_route', 'maintenance', 'inactive'].includes(v.status));
    } else if (statusFilter !== 'all') {
      list = list.filter(v => v.status === statusFilter);
    }
    return list;
  }, [vehicles, search, statusFilter]);

  // Clicking the same stat card again clears the filter.
  const toggleStatusFilter = (filter: typeof statusFilter) => {
    setStatusFilter((current) => (current === filter ? 'all' : filter));
  };

  // Highlights the active stat card when a status filter is applied.
  const statCardClass = (filter: typeof statusFilter) =>
    `cursor-pointer transition-all hover:shadow-md ${statusFilter === filter ? 'ring-2 ring-offset-2 ring-gray-900 shadow-md' : ''}`;

  // Fleet summary shown in the stats cards
  const stats = {
    total: vehicles.length,
    available: vehicles.filter(v => v.status === 'available').length,
    onRoute: vehicles.filter(v => v.status === 'on_route').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
  };

  // Permanently removes the selected vehicle
  const handleDelete = async () => {
    if (!deletingVehicle) return;
    try {
      const res = await fetch(`${API_BASE}/api/vehicles/${deletingVehicle.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || 'Failed to delete vehicle');
      }
      setDeletingVehicle(null);
      fetchVehicles();
    } catch {
      setError('Failed to delete vehicle');
    }
  };


  // Toggle between available and maintenance (on_route is system-managed)
  const handleStatusChange = async (vehicle: Vehicle, newStatus: string) => {
    try {
      await fetch(`${API_BASE}/api/vehicles/${vehicle.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchVehicles();
    } catch {
      setError('Failed to update status');
    }
  };

  return (
    <div className="p-8">
      {/* Page header and Add Vehicle button */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Vehicle Management</h2>
          <p className="text-gray-600">Manage collection vehicles, assignments, and availability</p>
        </div>
        <div className="flex items-center gap-3">

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Vehicle
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats — click to filter the list below */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className={statCardClass('all')} onClick={() => toggleStatusFilter('all')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Vehicles</p>
                <p className="text-2xl text-gray-900">{stats.total}</p>
              </div>
              <Truck className="w-10 h-10 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card className={statCardClass('available')} onClick={() => toggleStatusFilter('available')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Available</p>
                <p className="text-2xl text-green-600">{stats.available}</p>
              </div>
              <Check className="w-10 h-10 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card className={statCardClass('on_route')} onClick={() => toggleStatusFilter('on_route')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">On Route</p>
                <p className="text-2xl text-blue-600">{stats.onRoute}</p>
              </div>
              <Truck className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className={statCardClass('maintenance')} onClick={() => toggleStatusFilter('maintenance')}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Maintenance</p>
                <p className="text-2xl text-orange-600">{stats.maintenance}</p>
              </div>
              <Wrench className="w-10 h-10 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active stat-card filter banner */}
      {statusFilter !== 'all' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
          <span>
            Showing <strong>{getStatusLabel(statusFilter === 'available' ? 'available' : statusFilter)}</strong> vehicles only
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

      {/* Drivers list modal (optional picker for assignments) */}
      {showDriversListModal && (
        <DriversListModal
          drivers={drivers}
          loading={driversLoading}
          council={council}
          onClose={() => setShowDriversListModal(false)}
        />
      )}

      {/* Search & view mode */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search vehicles by license plate or type..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* Vehicles list — card grid or table; switches with ViewModeToggle */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading vehicles...</div>
      ) : displayedVehicles.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {statusFilter !== 'all'
            ? `No ${getStatusLabel(statusFilter === 'available' ? 'available' : statusFilter).toLowerCase()} vehicles found`
            : search ? 'No vehicles match your search' : 'No vehicles found. Click "Add Vehicle" to create one.'}
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Card grid view */}
          {displayedVehicles.map((vehicle) => {
            const statusStyles = getStatusRowStyles(vehicle.status);
            return (
              <Card key={vehicle.id} className="bg-white border-none shadow-sm overflow-hidden">
                <div className={`h-1.5 ${statusStyles.bar}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-lg font-semibold text-gray-900">{vehicle.licensePlate}</p>
                      {vehicle.vehicleCode && (
                        <p className="text-xs text-gray-500 mt-0.5">{vehicle.vehicleCode}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusStyles.badge}`}>
                      {getStatusLabel(vehicle.status)}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <span className="font-medium">{vehicle.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Capacity</span>
                      <span className="font-medium">{vehicle.capacity ? `${vehicle.capacity} tons` : '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500 shrink-0">Driver</span>
                      <span className="font-medium text-right flex items-center gap-1 justify-end">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {getDriverLabel(vehicle)}
                      </span>
                    </div>
                    {vehicle.currentLocation && (
                      <div className="flex items-start gap-1.5 pt-1">
                        <MapPin className="w-4 h-4 shrink-0 text-gray-400 mt-0.5" />
                        <span className="text-gray-700">{vehicle.currentLocation}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                    {vehicle.status === 'maintenance' ? (
                      <button
                        onClick={() => handleStatusChange(vehicle, 'available')}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/80 text-green-700 hover:bg-white border border-green-200"
                      >
                        Set Available
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusChange(vehicle, 'maintenance')}
                        disabled={vehicle.status === 'on_route'}
                        className="text-xs px-2.5 py-1 rounded-lg bg-white/80 text-amber-700 hover:bg-white border border-amber-200 disabled:opacity-50"
                      >
                        Maintenance
                      </button>
                    )}
                    <button
                      onClick={() => setEditingVehicle(vehicle)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit vehicle"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingVehicle(vehicle)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Delete vehicle"
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
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">License Plate</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Type</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Capacity</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Driver</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Location</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm">Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-sm text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedVehicles.map((vehicle) => {
                    const statusStyles = getStatusRowStyles(vehicle.status);
                    return (
                      <tr
                        key={vehicle.id}
                        className={`border-b border-white/60 transition-colors ${statusStyles.row}`}
                      >
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">{vehicle.licensePlate}</div>
                          {vehicle.vehicleCode && (
                            <div className="text-xs text-gray-500">{vehicle.vehicleCode}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{vehicle.type}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {vehicle.capacity ? `${vehicle.capacity} tons` : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <div className="flex items-center gap-1.5">
                            <User className="w-4 h-4 shrink-0 text-gray-400" />
                            {getDriverLabel(vehicle)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                          {vehicle.currentLocation ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 shrink-0 text-gray-400" />
                              <span className="truncate">{vehicle.currentLocation}</span>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusStyles.badge}`}>
                            {getStatusLabel(vehicle.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {vehicle.status === 'maintenance' ? (
                              <button
                                onClick={() => handleStatusChange(vehicle, 'available')}
                                className="text-xs px-2.5 py-1 rounded-lg bg-white/80 text-green-700 hover:bg-white border border-green-200"
                              >
                                Set Available
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(vehicle, 'maintenance')}
                                disabled={vehicle.status === 'on_route'}
                                className="text-xs px-2.5 py-1 rounded-lg bg-white/80 text-amber-700 hover:bg-white border border-amber-200 disabled:opacity-50"
                              >
                                Maintenance
                              </button>
                            )}
                            <button
                              onClick={() => setEditingVehicle(vehicle)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-white/60 rounded-lg transition-colors"
                              title="Edit vehicle"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingVehicle(vehicle)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-white/60 rounded-lg transition-colors"
                              title="Delete vehicle"
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

      {/* Create new vehicle modal */}
      {showCreateModal && (
        <VehicleFormModal
          vehicle={null}
          council={council}
          userRole={userRole}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            setShowCreateModal(false);
            fetchVehicles();
          }}
        />
      )}

      {/* Edit existing vehicle modal */}
      {editingVehicle && (
        <VehicleFormModal
          vehicle={editingVehicle}
          council={council}
          userRole={userRole}
          onClose={() => setEditingVehicle(null)}
          onSaved={() => {
            setEditingVehicle(null);
            fetchVehicles();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg text-gray-900 mb-2">Delete Vehicle</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingVehicle.licensePlate}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingVehicle(null)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* Create / Edit vehicle form */
function VehicleFormModal({
  vehicle,
  council,
  userRole,
  onClose,
  onSaved
}: {
  vehicle: Vehicle | null;
  council?: { name?: string; id?: string } | null;
  userRole?: 'admin' | 'superadmin' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!vehicle;
  const isAdmin = userRole === 'admin';
  const defaultCouncil = council?.name || '';
  const [form, setForm] = useState({
    licensePlate: vehicle?.licensePlate || '',
    type: vehicle?.type || VEHICLE_TYPES[0],
    capacity: vehicle?.capacity?.toString() || '',
    status: vehicle?.status || 'available',
    assignedCouncil: vehicle?.assignedCouncil || defaultCouncil,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Admins cannot change their council assignment
  useEffect(() => {
    if (!isAdmin) return;
    if (!defaultCouncil) return;
    setForm((prev) => ({ ...prev, assignedCouncil: defaultCouncil }));
  }, [isAdmin, defaultCouncil]);

  // Saves a new or updated vehicle to the backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.licensePlate.trim()) {
      setFormError('License plate is required');
      return;
    }
    setSaving(true);
    setFormError('');

    if (isAdmin && !defaultCouncil) {
      setFormError('Your admin account has no council assigned.');
      setSaving(false);
      return;
    }

    const payload = {

      licensePlate: form.licensePlate,
      type: form.type,
      capacity: form.capacity ? parseFloat(form.capacity) : null,
      status: form.status,
      assignedCouncil: (isAdmin ? defaultCouncil : form.assignedCouncil) || null,
    };

    try {
      const url = isEditing ? `${API_BASE}/api/vehicles/${vehicle!.id}` : `${API_BASE}/api/vehicles`;
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        setFormError(json.message || 'Failed to save vehicle');
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
          <h3 className="text-lg text-gray-900">{isEditing ? 'Edit Vehicle' : 'Create New Vehicle'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="block text-sm text-gray-600 mb-1">License Plate *</label>
              <Input value={form.licensePlate} onChange={e => setForm({...form, licensePlate: e.target.value})} placeholder="ABC-1234" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Type *</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Capacity (tons)</label>
              <Input type="number" step="0.1" value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} placeholder="5.0" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : (isEditing ? 'Update Vehicle' : 'Create Vehicle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Drivers List Modal ────────────────────────────────────────── */

// List of bin collectors available for vehicle assignment
function DriversListModal({
  drivers,
  loading,
  council,
  onClose,
}: {
  drivers: BinCollector[];
  loading: boolean;
  onClose: () => void;
  council?: { name?: string; id?: string } | null;
}) {
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg text-gray-900 font-medium">Bin Collectors (Staff Drivers)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>



        {loading ? (
          <div className="text-sm text-gray-500 py-8 text-center">Loading staff members...</div>
        ) : drivers.length === 0 ? (
          <div className="text-sm text-gray-500 py-8 text-center">No bin collectors found for {council?.name || 'this council'}.</div>
        ) : (
          <div className="space-y-2">
            {drivers.map((d) => (
              <div key={d.empId} className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-gray-50/50">
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 font-semibold">{d.empName || 'Unnamed Staff'}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    <div className="text-xs text-gray-500 font-mono">ID: #{d.empId}</div>
                    {d.email && <div className="text-xs text-blue-600 truncate max-w-[200px]">{d.email}</div>}
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-200">Staff</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
}

