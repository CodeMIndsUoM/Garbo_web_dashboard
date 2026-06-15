'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Truck, MapPin, Wrench, Search, Plus, Pencil, X, CircleCheck, Trash2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { PageHeader } from './layout/PageHeader';
import {
  CollapsibleEntityCard,
  EntityCardGrid,
  GlassFormCard,
  GlassFormRow,
  GlassFormSelect,
  GlassFormModal,
  StatCard,
  StatCardGrid,
  ViewModeToggle,
  glassFieldCompactClass,
  type ViewMode,
} from './layout/management-ui';
import { apiFetch } from '@/lib/api';
import { cn } from './ui/utils';

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
    case 'on_route':
      return 'border-status-info-border bg-status-info-muted text-status-info';
    case 'maintenance':
      return 'border-status-warning-border bg-status-warning-muted text-status-warning';
    case 'inactive':
      return 'border-border bg-muted text-muted-foreground';
    default:
      return 'border-status-success-border bg-status-success-muted text-status-success';
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

function getVehicleAccentClass(status: string) {
  switch (status) {
    case 'on_route':
      return 'bg-status-info';
    case 'maintenance':
      return 'bg-status-warning';
    case 'inactive':
      return 'bg-muted-foreground/40';
    default:
      return 'bg-status-success';
  }
}

export function VehicleManagement({ council, userRole }: { council?: { name?: string; id?: string } | null; userRole?: 'admin' | 'superadmin' | null }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allDrivers, setAllDrivers] = useState<BinCollector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
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
      <PageHeader
        title="Vehicle Management"
        subtitle="Manage collection vehicles, assignments, and availability"
        actions={
          <Button type="button" variant="brand" className="gap-2" onClick={() => setShowCreateModal(true)}>
            <Plus className="size-4" />
            Add Vehicle
          </Button>
        }
      />

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-status-danger-border bg-status-danger-muted p-3 text-status-danger">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">
            <X className="size-4" />
          </button>
        </div>
      )}

      <StatCardGrid columns={4} className="mb-8">
        <StatCard
          label="Total Vehicles"
          value={stats.total}
          icon={Truck}
          active={statusFilter === null}
          onClick={() => handleStatusCardClick(null)}
        />
        <StatCard
          label="Available"
          value={stats.available}
          valueClassName="text-status-success"
          icon={CircleCheck}
          iconClassName="text-status-success/70"
          active={statusFilter === 'available'}
          activeClassName="border-status-success ring-status-success/40"
          onClick={() => handleStatusCardClick('available')}
        />
        <StatCard
          label="On Route"
          value={stats.onRoute}
          valueClassName="text-status-info"
          icon={Truck}
          iconClassName="text-status-info/70"
          active={statusFilter === 'on_route'}
          activeClassName="border-status-info ring-status-info/40"
          onClick={() => handleStatusCardClick('on_route')}
        />
        <StatCard
          label="Maintenance"
          value={stats.maintenance}
          valueClassName="text-status-warning"
          icon={Wrench}
          iconClassName="text-status-warning/70"
          active={statusFilter === 'maintenance'}
          activeClassName="border-status-warning ring-status-warning/40"
          onClick={() => handleStatusCardClick('maintenance')}
        />
      </StatCardGrid>

      {/* Search + view toggle — card grid below is unchanged */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="relative min-w-0 w-full max-w-none flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vehicles by license plate or type..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Vehicles */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading vehicles...</div>
      ) : filteredVehicles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search ? 'No vehicles match your search' : 'No vehicles found. Click "Add Vehicle" to create one.'}
        </div>
      ) : viewMode === 'list' ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/80 hover:bg-muted/80">
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Max bins</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{vehicle.vehicleCode || vehicle.licensePlate}</p>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.vehicleCode ? vehicle.licensePlate : `ID: ${vehicle.id}`}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(vehicle.status)}>
                      {getStatusLabel(vehicle.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{vehicle.type}</TableCell>
                  <TableCell className="text-right font-medium">
                    {vehicle.maxBins ?? (vehicle.capacity ? Math.round(vehicle.capacity) : '—')}
                  </TableCell>
                  <TableCell>{getDriverLabel(vehicle)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {vehicle.currentLocation || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {vehicle.status === 'maintenance' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="brand"
                          className="h-8"
                          onClick={() => handleStatusChange(vehicle, 'available')}
                        >
                          Available
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => handleStatusChange(vehicle, 'maintenance')}
                          disabled={vehicle.status === 'on_route'}
                        >
                          Maintenance
                        </Button>
                      )}
                      <button
                        onClick={() => setEditingVehicle(vehicle)}
                        className="p-1.5 text-muted-foreground hover:text-muted-foreground"
                        aria-label="Edit vehicle"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeletingVehicle(vehicle)}
                        className="p-1.5 text-muted-foreground hover:text-red-600"
                        aria-label="Delete vehicle"
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
        <EntityCardGrid>
          {filteredVehicles.map((vehicle) => {
            const maxBins =
              vehicle.maxBins ?? (vehicle.capacity ? Math.round(vehicle.capacity) : null);
            const plateLabel = vehicle.vehicleCode
              ? vehicle.licensePlate
              : `ID: ${vehicle.id}`;

            return (
              <CollapsibleEntityCard
                key={vehicle.id}
                accentClass={getVehicleAccentClass(vehicle.status)}
                title={vehicle.vehicleCode || vehicle.licensePlate}
                subtitle={
                  <span className="flex items-center gap-1 line-clamp-1">
                    <Truck className="size-4 shrink-0" />
                    {plateLabel}
                  </span>
                }
                badge={
                  <Badge variant="outline" className={getStatusColor(vehicle.status)}>
                    {getStatusLabel(vehicle.status)}
                  </Badge>
                }
                headerActions={
                  <>
                    {vehicle.status === 'maintenance' ? (
                      <button
                        type="button"
                        title="Set available"
                        className="p-1 text-muted-foreground opacity-0 transition-all hover:text-status-success group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(vehicle, 'available');
                        }}
                      >
                        <CircleCheck className="size-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="Set maintenance"
                        disabled={vehicle.status === 'on_route'}
                        className="p-1 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(vehicle, 'maintenance');
                        }}
                      >
                        <Wrench className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Edit vehicle"
                      className="p-1 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingVehicle(vehicle);
                      }}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      title="Delete vehicle"
                      className="p-1 text-muted-foreground opacity-0 transition-all hover:text-status-danger group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingVehicle(vehicle);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                }
                primaryMetric={{
                  label: 'Driver',
                  value: getDriverLabel(vehicle),
                }}
                expandedContent={
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium text-foreground">{vehicle.type}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Max bins / trip</span>
                      <span className="font-medium text-foreground">{maxBins ?? '—'}</span>
                    </div>
                    {vehicle.currentLocation ? (
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                          <MapPin className="size-3.5" />
                          Location
                        </span>
                        <span className="line-clamp-1 text-right font-medium text-foreground">
                          {vehicle.currentLocation}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {vehicle.status === 'maintenance' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="brand"
                          className="h-8 gap-1.5"
                          onClick={() => handleStatusChange(vehicle, 'available')}
                        >
                          <CircleCheck className="size-3.5" />
                          Set Available
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5"
                          onClick={() => handleStatusChange(vehicle, 'maintenance')}
                          disabled={vehicle.status === 'on_route'}
                        >
                          <Wrench className="size-3.5" />
                          Set Maintenance
                        </Button>
                      )}
                    </div>
                  </>
                }
              />
            );
          })}
        </EntityCardGrid>
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
          <div className="bg-card rounded-xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg text-foreground mb-2">Delete Vehicle</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete <strong>{deletingVehicle.licensePlate}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingVehicle(null)} className="px-4 py-2 text-muted-foreground border border-gray-300 rounded-lg hover:bg-muted">Cancel</button>
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

  const formId = 'vehicle-form';
  const displayTitle = form.licensePlate.trim() || (isEditing ? 'Edit vehicle' : 'New vehicle');

  return (
    <GlassFormModal
      open
      onClose={onClose}
      title={isEditing ? 'Edit Vehicle' : 'Create Vehicle'}
      icon={<Truck className="h-5 w-5 shrink-0 text-green-600" />}
      error={formError || undefined}
      footer={
        <div className="flex w-full justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-border bg-slate-100 px-3 py-2 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <CircleCheck className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : isEditing ? 'Update Vehicle' : 'Create Vehicle'}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit}>
        <GlassFormCard
          title={displayTitle}
          accentClass={getVehicleAccentClass(form.status)}
          badge={
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                getStatusColor(form.status)
              )}
            >
              {isEditing ? getStatusLabel(form.status) : 'New'}
            </span>
          }
        >
          <GlassFormRow label="License plate:">
            <Input
              id="vehicle-license-plate"
              className={glassFieldCompactClass}
              value={form.licensePlate}
              onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
              placeholder="ABC-1234"
              required
            />
          </GlassFormRow>
          <GlassFormRow label="Type:">
            <GlassFormSelect
              id="vehicle-type"
              className={cn(glassFieldCompactClass, 'w-[10rem]')}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
            >
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </GlassFormSelect>
          </GlassFormRow>
          <GlassFormRow label="Max bins / trip:">
            <Input
              id="vehicle-max-bins"
              type="number"
              min={1}
              step={1}
              className={cn(glassFieldCompactClass, 'w-[6rem]')}
              value={form.maxBins}
              onChange={(e) => setForm({ ...form, maxBins: e.target.value })}
              placeholder="50"
            />
          </GlassFormRow>
          {vehicle?.vehicleCode ? (
            <GlassFormRow label="Vehicle code:">
              <span className="font-medium text-foreground">{vehicle.vehicleCode}</span>
            </GlassFormRow>
          ) : null}
          {isEditing && vehicle?.id ? (
            <GlassFormRow label="Vehicle ID:">
              <span className="font-medium text-foreground">{vehicle.id}</span>
            </GlassFormRow>
          ) : null}
        </GlassFormCard>
      </form>
    </GlassFormModal>
  );
}

