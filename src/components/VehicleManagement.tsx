'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, MapPin, Wrench, Search, Plus, Pencil, X, Check, User, Trash2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081';

interface Vehicle {
  id: number;

  licensePlate: string;
  type: string;
  capacity: number | null;
  status: string;
  assignedCouncil: string;
  assignedDriverId: number | null;
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
  const [drivers, setDrivers] = useState<BinCollector[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [showDriversListModal, setShowDriversListModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<BinCollector | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<BinCollector | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState('');

  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchDrivers = useCallback(async () => {
    try {
      const url = `${API_BASE}/api/admins/staff`;
      const res = await fetch(url, { headers: authHeaders() });
      const json = await res.json();
      if (json.success) {
        const staff: any[] = Array.isArray(json.data) ? json.data : [];
        const collectors = staff.filter(s => (s.role || '').toString().toUpperCase() === 'BIN_COLLECTOR');
        
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

  const driversById = useMemo(() => {
    const map = new Map<number, BinCollector>();
    for (const driver of drivers) map.set(driver.empId, driver);
    return map;
  }, [drivers]);

  const getDriverLabel = useCallback((driverId: number | null) => {
    if (!driverId) return 'Unassigned';
    const driver = driversById.get(driverId);
    if (!driver) return `#${driverId}`;
    return driver.empName || `Staff #${driverId}`;
  }, [driversById]);

  const handleDriverUpdated = () => {
    setEditingDriver(null);
    fetchDrivers();
  };

  const filteredVehicles = vehicles.filter(v =>
    v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
    v.type.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: vehicles.length,
    available: vehicles.filter(v => v.status === 'available').length,
    onRoute: vehicles.filter(v => v.status === 'on_route').length,
    maintenance: vehicles.filter(v => v.status === 'maintenance').length,
  };

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 mb-2">Vehicle Management</h2>
          <p className="text-gray-600">Manage collection vehicles, assignments, and availability</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDriversListModal(true)}
            className="px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Drivers
          </button>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
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
        <Card>
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
        <Card>
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
        <Card>
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

      {showDriversListModal && (
        <DriversListModal
          drivers={drivers}
          loading={driversLoading}
          council={council}
          onClose={() => setShowDriversListModal(false)}
        />
      )}

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
                      <span className="text-gray-600">Capacity</span>
                      <span className="text-gray-900">{vehicle.capacity ? `${vehicle.capacity} tons` : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1"><User className="w-3 h-3" /> Driver</span>
                      <span className="text-gray-900">{getDriverLabel(vehicle.assignedDriverId)}</span>
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

      {/* Create / Edit Modal */}
      {(showCreateModal || editingVehicle) && (
        <VehicleFormModal
          vehicle={editingVehicle}
          drivers={drivers}
          council={council}
          userRole={userRole}
          onClose={() => { setShowCreateModal(false); setEditingVehicle(null); }}
          onSaved={() => { setShowCreateModal(false); setEditingVehicle(null); fetchVehicles(); }}
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
  drivers,
  council,
  userRole,
  onClose,
  onSaved
}: {
  vehicle: Vehicle | null;
  drivers: BinCollector[];
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
    assignedDriverId: vehicle?.assignedDriverId?.toString() || '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

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
      capacity: form.capacity ? parseFloat(form.capacity) : null,
      status: form.status,
      // Enforce council ownership server payload for admins.
      assignedCouncil: (isAdmin ? defaultCouncil : form.assignedCouncil) || null,
      assignedDriverId: form.assignedDriverId ? parseInt(form.assignedDriverId) : null,
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Status</label>
              <select 
                value={form.status} 
                onChange={e => setForm({...form, status: e.target.value})} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 cursor-not-allowed"
                disabled
              >
                {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">Status is updated automatically or via card actions.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Assigned Council</label>
            <select
              value={form.assignedCouncil}
              onChange={e => setForm({ ...form, assignedCouncil: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                disabled={isAdmin}
            >
                <option value="">{isAdmin ? (defaultCouncil || 'No council found') : 'Select council'}</option>
                {COUNCILS.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Assigned Driver (Staff)</label>
            <select
              value={form.assignedDriverId}
              onChange={e => setForm({ ...form, assignedDriverId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">-- No Driver --</option>
              {drivers.map((d) => (
                <option key={d.empId} value={d.empId.toString()}>
                  {d.empName || d.email} (ID: {d.empId})
                </option>
              ))}
            </select>
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

function DriversListModal({
  drivers,
  loading,
  onClose,
  council,
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

        {showCreate && (
          <div className="mb-6 border border-gray-200 rounded-lg p-4">
            {formError && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-3">

              <div>
                <label className="block text-sm text-gray-600 mb-1">Driver Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kasun Perera" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Email</label>
                  <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="kasun@example.com" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Phone</label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="0771234567" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setFormError(''); }}
                  className="px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Create Driver'}
                </button>
              </div>
            </form>
          </div>
        )}

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

