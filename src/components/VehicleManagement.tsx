'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, MapPin, Fuel, Wrench, Search, Plus, Pencil, X, Check, User, Trash2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Progress } from './ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080';

interface Vehicle {
  id: number;
  vehicleCode: string;
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

interface Driver {
  id: number;
  driverCode: string;
  name?: string;
}

const VEHICLE_TYPES = ['Truck', 'Compactor', 'Mini Truck'];
const VEHICLE_STATUSES = ['available', 'on_route', 'maintenance', 'inactive'];

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

export function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [showDriversListModal, setShowDriversListModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);
  const [error, setError] = useState('');

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/drivers`);
      const json = await res.json();
      if (json.success) {
        setDrivers(json.data);
      }
    } catch {
      console.error('Failed to fetch drivers');
    } finally {
      setDriversLoading(false);
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/vehicles`);
      const json = await res.json();
      if (json.success) {
        setVehicles(json.data);
      }
    } catch {
      console.error('Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);
  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const driversById = useMemo(() => {
    const map = new Map<number, Driver>();
    for (const driver of drivers) map.set(driver.id, driver);
    return map;
  }, [drivers]);

  const getDriverLabel = useCallback((driverId: number | null) => {
    if (!driverId) return 'Unassigned';
    const driver = driversById.get(driverId);
    if (!driver) return `#${driverId}`;
    if (driver.name && driver.name.trim()) return driver.name;
    return driver.driverCode || `#${driverId}`;
  }, [driversById]);

  const handleDriverUpdated = () => {
    setEditingDriver(null);
    fetchDrivers();
  };

  const filteredVehicles = vehicles.filter(v =>
    v.vehicleCode.toLowerCase().includes(search.toLowerCase()) ||
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
      const res = await fetch(`${API_BASE}/api/vehicles/${deletingVehicle.id}`, { method: 'DELETE' });
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

  const handleDeleteDriver = async () => {
    if (!deletingDriver) return;
    try {
      const res = await fetch(`${API_BASE}/api/drivers/${deletingDriver.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || 'Failed to delete driver');
      }
      setDeletingDriver(null);
      fetchDrivers();
      fetchVehicles();
    } catch {
      setError('Failed to delete driver');
    }
  };

  const handleStatusChange = async (vehicle: Vehicle, newStatus: string) => {
    try {
      await fetch(`${API_BASE}/api/vehicles/${vehicle.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
          onClose={() => setShowDriversListModal(false)}
          onEdit={(driver) => { setShowDriversListModal(false); setEditingDriver(driver); }}
          onDelete={(driver) => { setShowDriversListModal(false); setDeletingDriver(driver); }}
          onCreated={() => { fetchDrivers(); fetchVehicles(); }}
          setGlobalError={setError}
        />
      )}

      {editingDriver && (
        <DriverEditModal
          driver={editingDriver}
          onClose={() => setEditingDriver(null)}
          onSaved={handleDriverUpdated}
          setGlobalError={setError}
        />
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search vehicles by code, license plate, or type..."
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
            <Card key={vehicle.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-gray-900 mb-1">{vehicle.vehicleCode}</h3>
                    <p className="text-sm text-gray-500">{vehicle.licensePlate}</p>
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
                  {/* Fuel Level */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 flex items-center gap-1">
                        <Fuel className="w-4 h-4" />
                        Fuel Level
                      </span>
                      <span className="text-sm text-gray-900">{vehicle.fuelLevel}%</span>
                    </div>
                    <Progress
                      value={vehicle.fuelLevel}
                      className={
                        vehicle.fuelLevel < 30 ? '[&>div]:bg-red-500'
                          : vehicle.fuelLevel < 60 ? '[&>div]:bg-orange-500'
                          : '[&>div]:bg-green-500'
                      }
                    />
                  </div>

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
                      <span className="text-gray-600">Council</span>
                      <span className="text-gray-900">{vehicle.assignedCouncil || '—'}</span>
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
                      {VEHICLE_STATUSES.filter(s => s !== vehicle.status).map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(vehicle, s)}
                          className={`text-xs px-2 py-1 rounded transition-colors ${getStatusColor(s)} hover:opacity-80`}
                        >
                          {getStatusLabel(s)}
                        </button>
                      ))}
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
              Are you sure you want to delete <strong>{deletingVehicle.vehicleCode}</strong> ({deletingVehicle.licensePlate})?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingVehicle(null)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Delete Confirmation */}
      {deletingDriver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg text-gray-900 mb-2">Delete Driver</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{deletingDriver.driverCode}</strong>{deletingDriver.name ? ` (${deletingDriver.name})` : ''}?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingDriver(null)} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteDriver} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Create / Edit Modal ────────────────────────────────────────── */

function VehicleFormModal({ vehicle, drivers, onClose, onSaved }: { vehicle: Vehicle | null; drivers: Driver[]; onClose: () => void; onSaved: () => void }) {
  const isEditing = !!vehicle;
  const [form, setForm] = useState({
    vehicleCode: vehicle?.vehicleCode || '',
    licensePlate: vehicle?.licensePlate || '',
    type: vehicle?.type || VEHICLE_TYPES[0],
    capacity: vehicle?.capacity?.toString() || '',
    status: vehicle?.status || 'available',
    assignedCouncil: vehicle?.assignedCouncil || '',
    assignedDriverId: vehicle?.assignedDriverId?.toString() || '',
    currentLocation: vehicle?.currentLocation || '',
    fuelLevel: vehicle?.fuelLevel?.toString() || '100',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleCode.trim() || !form.licensePlate.trim()) {
      setFormError('Vehicle code and license plate are required');
      return;
    }
    setSaving(true);
    setFormError('');

    const payload = {
      vehicleCode: form.vehicleCode,
      licensePlate: form.licensePlate,
      type: form.type,
      capacity: form.capacity ? parseFloat(form.capacity) : null,
      status: form.status,
      assignedCouncil: form.assignedCouncil || null,
      assignedDriverId: form.assignedDriverId ? parseInt(form.assignedDriverId) : null,
      currentLocation: form.currentLocation || null,
      fuelLevel: parseInt(form.fuelLevel) || 100,
    };

    try {
      const url = isEditing ? `${API_BASE}/api/vehicles/${vehicle!.id}` : `${API_BASE}/api/vehicles`;
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
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
              <label className="block text-sm text-gray-600 mb-1">Vehicle Code *</label>
              <Input value={form.vehicleCode} onChange={e => setForm({...form, vehicleCode: e.target.value})} placeholder="VEH-001" disabled={isEditing} />
            </div>
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
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Fuel Level (%)</label>
              <Input type="number" min={0} max={100} value={form.fuelLevel} onChange={e => setForm({...form, fuelLevel: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Assigned Council</label>
            <select
              value={form.assignedCouncil}
              onChange={e => setForm({ ...form, assignedCouncil: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Select council</option>
              <option value="Colombo">Colombo</option>
              <option value="Galle">Galle</option>
              <option value="Moratuwa">Moratuwa</option>
              <option value="Kandy">Kandy</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Driver Code</label>
              <select
                value={form.assignedDriverId}
                onChange={e => setForm({ ...form, assignedDriverId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Unassigned</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id.toString()}>{d.name ? `${d.driverCode} - ${d.name}` : d.driverCode}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Current Location</label>
              <Input value={form.currentLocation} onChange={e => setForm({...form, currentLocation: e.target.value})} placeholder="Downtown Area" />
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

function DriversListModal({
  drivers,
  loading,
  onClose,
  onEdit,
  onDelete,
  onCreated,
  setGlobalError,
}: {
  drivers: Driver[];
  loading: boolean;
  onClose: () => void;
  onEdit: (driver: Driver) => void;
  onDelete: (driver: Driver) => void;
  onCreated: () => void;
  setGlobalError: (msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ driverCode: '', name: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.driverCode.trim() || !form.name.trim()) {
      setFormError('Driver code and name are required');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const res = await fetch(`${API_BASE}/api/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverCode: form.driverCode.trim(), name: form.name.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success) {
        setForm({ driverCode: '', name: '' });
        setShowCreate(false);
        onCreated();
      } else {
        setFormError(json?.message || 'Failed to add driver');
      }
    } catch {
      setGlobalError('Failed to add driver');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg text-gray-900">Drivers</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowCreate((v) => !v); setFormError(''); }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add New Driver
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {showCreate && (
          <div className="mb-6 border border-gray-200 rounded-lg p-4">
            {formError && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Driver Code *</label>
                <Input value={form.driverCode} onChange={e => setForm({ ...form, driverCode: e.target.value })} placeholder="DRV-001" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Driver Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kasun Perera" />
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
          <div className="text-sm text-gray-500">Loading drivers...</div>
        ) : drivers.length === 0 ? (
          <div className="text-sm text-gray-500">No drivers found.</div>
        ) : (
          <div className="space-y-2">
            {drivers.map((d) => (
              <div key={d.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 truncate">{d.driverCode}{d.name ? ` - ${d.name}` : ''}</div>
                  <div className="text-xs text-gray-500">#{d.id}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit(d)}
                    className="text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
                    title="Edit driver"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(d)}
                    className="text-gray-500 hover:text-red-600 px-2 py-1 rounded"
                    title="Delete driver"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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

/* ── Driver Edit Modal ─────────────────────────────────────────── */

function DriverEditModal({
  driver,
  onClose,
  onSaved,
  setGlobalError,
}: {
  driver: Driver;
  onClose: () => void;
  onSaved: () => void;
  setGlobalError: (msg: string) => void;
}) {
  const [form, setForm] = useState({ driverCode: driver.driverCode || '', name: driver.name || '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.driverCode.trim() || !form.name.trim()) {
      setFormError('Driver code and name are required');
      return;
    }
    setSaving(true);
    setFormError('');

    try {
      const res = await fetch(`${API_BASE}/api/drivers/${driver.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverCode: form.driverCode.trim(), name: form.name.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        onSaved();
      } else {
        setFormError(json.message || 'Failed to update driver');
      }
    } catch {
      setGlobalError('Failed to update driver');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg text-gray-900">Edit Driver</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        {formError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{formError}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Driver Code *</label>
            <Input value={form.driverCode} onChange={e => setForm({ ...form, driverCode: e.target.value })} placeholder="DRV-001" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Driver Name *</label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Kasun Perera" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              <Check className="w-4 h-4" />
              {saving ? 'Saving...' : 'Update Driver'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
