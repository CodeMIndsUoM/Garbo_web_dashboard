'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, MapPin, Wrench, Search, Plus, Pencil, X, Check, User, Trash2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { apiFetch } from '@/lib/api';

interface Vehicle {
  id: number;

  licensePlate: string;
  vehicleCode?: string | null;
  type: string;
  capacity: number | null;
  maxBins: number | null;
  status: string;
  assignedCouncil: string;
  assignedDriverId: number | null;
  assignedDriverName?: string | null;
  currentLocation: string;
  fuelLevel: number;
  isActive: boolean;
  lastMaintenanceAt: string | null;
  createdAt: string;
  updatedAt: string;
}

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
const VEHICLE_STATUSES = ['available', 'on_route', 'maintenance'];

function getStatusColor(status: string) {
  switch (status) {
    case 'on_route': return 'bg-blue-100 text-blue-700';
    case 'maintenance': return 'bg-orange-100 text-orange-700';
    case 'inactive': return 'bg-gray-100 text-gray-500';
    default: return 'bg-green-100 text-green-700';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'on_route': return 'On Route';
    case 'maintenance': return 'Maintenance';
    case 'inactive': return 'Inactive';
    default: return 'Available';
  }
}

export function VehicleManagement({ council, userRole }: { council?: { name?: string; id?: string } | null; userRole?: 'admin' | 'superadmin' | null }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allDrivers, setAllDrivers] = useState<BinCollector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState('');

  const fetchDrivers = useCallback(async () => {
    try {
      const { data: json } = await apiFetch<{ success?: boolean; data?: any[] }>(
        '/api/admins/staff'
      );
      if (json.success) {
        const staff: any[] = Array.isArray(json.data) ? json.data : [];
        const collectors = staff.filter(s => (s.role || '').toString().toUpperCase() === 'BIN_COLLECTOR');
        setAllDrivers(collectors);
      }
    } catch {
      console.error('Failed to fetch drivers (bin collectors)');
    }
  }, [council]);

  const fetchVehicles = useCallback(async () => {
    try {
      const councilQuery = council?.name || council?.id || '';
      const path = `/api/vehicles${councilQuery ? `?council=${encodeURIComponent(councilQuery)}` : ''}`;
      const { data: json } = await apiFetch<{ success?: boolean; data?: Vehicle[] }>(path);
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

  const driversById = useMemo(() => {
    const map = new Map<number, BinCollector>();
    for (const driver of allDrivers) map.set(driver.empId, driver);
    return map;
  }, [allDrivers]);

  const getDriverLabel = useCallback((vehicle: Vehicle) => {
    const { assignedDriverId, assignedDriverName } = vehicle;
    if (!assignedDriverId) return 'Unassigned';
    if (assignedDriverName) return assignedDriverName;
    
    const driver = driversById.get(assignedDriverId);
    if (!driver) return `#${assignedDriverId}`;
    return driver.empName || `Staff #${assignedDriverId}`;
  }, [driversById]);

  const stats = useMemo(
    () => ({
      total: vehicles.length,
      available: vehicles.filter((v) => v.status === 'available').length,
      onRoute: vehicles.filter((v) => v.status === 'on_route').length,
      maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    }),
    [vehicles]
  );

  const filteredVehicles = useMemo(() => {
    let result = vehicles;
    if (statusFilter) {
      result = result.filter((v) => v.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) =>
          v.licensePlate.toLowerCase().includes(q) ||
          v.type.toLowerCase().includes(q)
      );
    }
    return result;
  }, [vehicles, statusFilter, search]);

  const handleStatusCardClick = (filter: string | null) => {
    setStatusFilter((prev) => (prev === filter ? null : filter));
  };

  const statCardClass = (active: boolean) =>
    `cursor-pointer transition-all hover:shadow-md ${
      active ? 'ring-2 ring-blue-500 shadow-md' : ''
    }`;

  const handleDelete = async () => {
    if (!deletingVehicle) return;
    try {
      const { response, data: json } = await apiFetch<{ message?: string }>(
        `/api/vehicles/${deletingVehicle.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        throw new Error(json?.message || 'Failed to delete vehicle');
      }
      setDeletingVehicle(null);
      fetchVehicles();
    } catch {
      setError('Failed to delete vehicle');
    }
  };


  const handleStatusChange = async (vehicle: Vehicle, newStatus: string) => {
    try {
      await apiFetch(`/api/vehicles/${vehicle.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchVehicles();
    } catch {
      setError('Failed to update status');
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Vehicle Management</h2>
          <p className="text-gray-600">Manage collection vehicles, assignments, and availability</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Vehicle
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats — click a card to filter the grid below */}
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
                <p className="text-sm text-gray-600 mb-1">Total Vehicles</p>
                <p className="text-2xl text-gray-900">{stats.total}</p>
              </div>
              <Truck className="w-10 h-10 text-gray-400" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={statCardClass(statusFilter === 'available')}
          onClick={() => handleStatusCardClick('available')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleStatusCardClick('available')}
        >
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
        <Card
          className={statCardClass(statusFilter === 'on_route')}
          onClick={() => handleStatusCardClick('on_route')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleStatusCardClick('on_route')}
        >
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
        <Card
          className={statCardClass(statusFilter === 'maintenance')}
          onClick={() => handleStatusCardClick('maintenance')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleStatusCardClick('maintenance')}
        >
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

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search vehicles by license plate or type..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Vehicles Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading vehicles...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {search ? 'No vehicles match your search' : 'No vehicles found. Click "Add Vehicle" to create one.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => (
            <Card key={vehicle.id} className="hover:shadow-lg transition-all duration-300 border-gray-100 overflow-hidden relative">
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                vehicle.status === 'available' ? 'bg-green-500' :
                vehicle.status === 'on_route' ? 'bg-blue-500' :
                vehicle.status === 'maintenance' ? 'bg-amber-500' :
                'bg-gray-400'
              }`} />
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-gray-900 mb-1">{vehicle.vehicleCode || vehicle.licensePlate}</h3>
                    <p className="text-sm text-gray-500">{vehicle.vehicleCode ? vehicle.licensePlate : `ID: ${vehicle.id}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={getStatusColor(vehicle.status)}>
                      {getStatusLabel(vehicle.status)}
                    </Badge>
                    <button onClick={() => setEditingVehicle(vehicle)} className="text-gray-400 hover:text-gray-600">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeletingVehicle(vehicle)} className="text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">

                  {/* Info */}
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Type</span>
                      <span className="text-gray-900">{vehicle.type}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Max bins / trip</span>
                      <span className="text-gray-900">
                        {vehicle.maxBins ?? (vehicle.capacity ? Math.round(vehicle.capacity) : '—')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1"><User className="w-3 h-3" /> Driver</span>
                      <span className="text-gray-900">{getDriverLabel(vehicle)}</span>
                    </div>
                    {vehicle.currentLocation && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1"><MapPin className="w-3 h-3" /> Location</span>
                        <span className="text-gray-900 line-clamp-1">{vehicle.currentLocation}</span>
                      </div>
                    )}
                  </div>

                  {/* Status Quick Actions */}
                  <div className="pt-2 border-t border-gray-100">
                      <div className="flex gap-1 flex-wrap">
                        {/* Only allow manual toggle to/from Maintenance */}
                        {vehicle.status === 'maintenance' ? (
                          <button
                            onClick={() => handleStatusChange(vehicle, 'available')}
                            className={`text-xs px-2 py-1 rounded transition-colors bg-green-50 text-green-700 hover:opacity-80 border border-green-100`}
                          >
                            Set Available
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(vehicle, 'maintenance')}
                            className={`text-xs px-2 py-1 rounded transition-colors bg-amber-50 text-amber-700 hover:opacity-80 border border-amber-100`}
                            disabled={vehicle.status === 'on_route'}
                          >
                            Set Maintenance
                          </button>
                        )}
                      </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

/* ── Create / Edit Modal ────────────────────────────────────────── */

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
    maxBins: vehicle?.maxBins?.toString() || (vehicle?.capacity ? String(Math.round(vehicle.capacity)) : ''),
    status: vehicle?.status || 'available',
    assignedCouncil: vehicle?.assignedCouncil || defaultCouncil,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  useEffect(() => {
    if (!isAdmin) return;
    if (!defaultCouncil) return;
    setForm((prev) => ({ ...prev, assignedCouncil: defaultCouncil }));
  }, [isAdmin, defaultCouncil]);

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
      maxBins: form.maxBins ? parseInt(form.maxBins, 10) : null,
      status: form.status,
      // Enforce council ownership server payload for admins.
      assignedCouncil: (isAdmin ? defaultCouncil : form.assignedCouncil) || null,
    };

    try {
      const path = isEditing ? `/api/vehicles/${vehicle!.id}` : '/api/vehicles';
      const method = isEditing ? 'PUT' : 'POST';
      const { data: json } = await apiFetch<{ success?: boolean; message?: string }>(path, {
        method,
        body: JSON.stringify(payload),
      });
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
              <label className="block text-sm text-gray-600 mb-1">Max bins per trip</label>
              <Input type="number" min="1" step="1" value={form.maxBins} onChange={e => setForm({...form, maxBins: e.target.value})} placeholder="50" />
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

