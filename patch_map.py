import re

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'r') as f:
    content = f.read()

# 1. Add helpers at the top (after STATUS_COLOR_MAP)
helpers = """
const DRIVER_VEHICLE_CACHE_KEY = 'garbo_driver_vehicle_prefs';

const getSavedVehicleForDriver = (driverId: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const prefs = JSON.parse(localStorage.getItem(DRIVER_VEHICLE_CACHE_KEY) || '{}');
    return prefs[driverId] || null;
  } catch (e) {
    return null;
  }
};

const saveVehicleForDriver = (driverId: string, vehicleId: string) => {
  if (typeof window === 'undefined') return;
  try {
    const prefs = JSON.parse(localStorage.getItem(DRIVER_VEHICLE_CACHE_KEY) || '{}');
    if (vehicleId) {
      prefs[driverId] = vehicleId;
    } else {
      delete prefs[driverId];
    }
    localStorage.setItem(DRIVER_VEHICLE_CACHE_KEY, JSON.stringify(prefs));
  } catch (e) {
  }
};
"""
if "DRIVER_VEHICLE_CACHE_KEY" not in content:
    content = content.replace("const STATUS_COLOR_MAP: Record<string, string> = {", helpers + "\nconst STATUS_COLOR_MAP: Record<string, string> = {")

# 2. Swap Manual Mode fields
manual_old = """                  <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                    Vehicle
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                  >
                    {renderVehicleOptions(selectedBins.length, selectedVehicleId)}
                  </select>
                  {selectedBins.length > 0 && vehicles.every((v) => !isVehicleCapacitySufficient(v, selectedBins.length)) && (
                    <p className="text-[10px] text-red-600 mt-1">No vehicle has enough capacity for {selectedBins.length} bins</p>
                  )}
                </div>
                <div>
                  <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                    Driver
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                  >
                    <option value="">-- Driver --</option>
                    {drivers.map((d) => (
                      <option key={d.empId} value={d.empId}>
                        {d.empName || 'Unnamed'}
                      </option>
                    ))}
                  </select>"""

manual_new = """                  <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                    Driver
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => {
                      const newDriverId = e.target.value;
                      setSelectedDriverId(newDriverId);
                      if (newDriverId) {
                        const cached = getSavedVehicleForDriver(newDriverId);
                        if (cached && vehicles.some(v => v.id.toString() === cached || v.vehicleCode === cached)) {
                          setSelectedVehicleId(cached);
                        }
                      }
                    }}
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                  >
                    <option value="">-- Driver --</option>
                    {drivers.map((d) => (
                      <option key={d.empId} value={d.empId}>
                        {d.empName || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                    Vehicle
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      const newVehicleId = e.target.value;
                      setSelectedVehicleId(newVehicleId);
                      if (selectedDriverId) {
                        saveVehicleForDriver(selectedDriverId, newVehicleId);
                      }
                    }}
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                  >
                    {renderVehicleOptions(selectedBins.length, selectedVehicleId)}
                  </select>
                  {selectedBins.length > 0 && vehicles.every((v) => !isVehicleCapacitySufficient(v, selectedBins.length)) && (
                    <p className="text-[10px] text-red-600 mt-1">No vehicle has enough capacity for {selectedBins.length} bins</p>
                  )}"""

content = content.replace(manual_old, manual_new)

# 3. Swap Auto Mode fields
auto_old = """                            <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                              Vehicle
                            </label>
                            <select
                              value={draftAssignments[draft.draftId]?.vehicleId ?? ''}
                              onChange={(e) =>
                                setDraftAssignments((prev) => ({
                                  ...prev,
                                  [draft.draftId]: {
                                    driverId: prev[draft.draftId]?.driverId ?? '',
                                    vehicleId: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                            >
                              {renderVehicleOptions(draft.totalBins, draftAssignments[draft.draftId]?.vehicleId ?? '')}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                              Driver
                            </label>
                            <select
                              value={draftAssignments[draft.draftId]?.driverId ?? ''}
                              onChange={(e) =>
                                setDraftAssignments((prev) => ({
                                  ...prev,
                                  [draft.draftId]: {
                                    vehicleId: prev[draft.draftId]?.vehicleId ?? '',
                                    driverId: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                            >
                              <option value="">-- Driver --</option>
                              {drivers.map((d) => (
                                <option key={d.empId} value={d.empId}>
                                  {d.empName || 'Unnamed'}
                                </option>
                              ))}
                            </select>"""

auto_new = """                            <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                              Driver
                            </label>
                            <select
                              value={draftAssignments[draft.draftId]?.driverId ?? ''}
                              onChange={(e) => {
                                const newDriverId = e.target.value;
                                setDraftAssignments((prev) => {
                                  let newVehicleId = prev[draft.draftId]?.vehicleId ?? '';
                                  if (newDriverId) {
                                    const cached = getSavedVehicleForDriver(newDriverId);
                                    if (cached && vehicles.some(v => v.id.toString() === cached || v.vehicleCode === cached)) {
                                      newVehicleId = cached;
                                    }
                                  }
                                  return {
                                    ...prev,
                                    [draft.draftId]: {
                                      vehicleId: newVehicleId,
                                      driverId: newDriverId,
                                    },
                                  };
                                });
                              }}
                              className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                            >
                              <option value="">-- Driver --</option>
                              {drivers.map((d) => (
                                <option key={d.empId} value={d.empId}>
                                  {d.empName || 'Unnamed'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[var(--glass-text-muted)] mb-1 text-[10px] font-bold uppercase tracking-wider">
                              Vehicle
                            </label>
                            <select
                              value={draftAssignments[draft.draftId]?.vehicleId ?? ''}
                              onChange={(e) => {
                                const newVehicleId = e.target.value;
                                setDraftAssignments((prev) => {
                                  const currentDriverId = prev[draft.draftId]?.driverId ?? '';
                                  if (currentDriverId) {
                                    saveVehicleForDriver(currentDriverId, newVehicleId);
                                  }
                                  return {
                                    ...prev,
                                    [draft.draftId]: {
                                      driverId: currentDriverId,
                                      vehicleId: newVehicleId,
                                    },
                                  };
                                });
                              }}
                              className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-field)] px-3 py-2 text-xs text-[var(--glass-text)] outline-none focus:border-brand-600"
                            >
                              {renderVehicleOptions(draft.totalBins, draftAssignments[draft.draftId]?.vehicleId ?? '')}
                            </select>"""
content = content.replace(auto_old, auto_new)

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'w') as f:
    f.write(content)

