import re

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'r') as f:
    content = f.read()

helpers = """
const getLatestVehicleForDriver = (driverId: string, drivers: any[], vehicles: any[], assignedRoutes: any[]) => {
  if (!driverId) return null;
  // 1. Try local storage cache
  const cached = getSavedVehicleForDriver(driverId);
  if (cached) return cached;
  
  // 2. Fallback to assigned routes history
  const driver = drivers.find(d => d.empId.toString() === driverId);
  if (driver && driver.empName) {
    // assignedRoutes is usually sorted by createdDate descending
    const lastRoute = assignedRoutes.find(r => r.driverName === driver.empName);
    if (lastRoute && lastRoute.vehicleCode) {
      const vehicle = vehicles.find(v => v.vehicleCode === lastRoute.vehicleCode || v.licensePlate === lastRoute.vehicleCode);
      if (vehicle) return vehicle.id.toString();
    }
  }
  return null;
};
"""

if "getLatestVehicleForDriver" not in content:
    content = content.replace("const getSavedVehicleForDriver", helpers + "\nconst getSavedVehicleForDriver")

# Manual mode driver change
manual_old = """                  <select
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
                    }}"""

manual_new = """                  <select
                    value={selectedDriverId}
                    onChange={(e) => {
                      const newDriverId = e.target.value;
                      setSelectedDriverId(newDriverId);
                      if (newDriverId) {
                        const latest = getLatestVehicleForDriver(newDriverId, drivers, vehicles, assignedRoutes);
                        if (latest && vehicles.some(v => v.id.toString() === latest || v.vehicleCode === latest)) {
                          setSelectedVehicleId(latest);
                        }
                      }
                    }}"""
content = content.replace(manual_old, manual_new)

# Auto mode driver change
auto_old = """                            <select
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
                                  }"""

auto_new = """                            <select
                              value={draftAssignments[draft.draftId]?.driverId ?? ''}
                              onChange={(e) => {
                                const newDriverId = e.target.value;
                                setDraftAssignments((prev) => {
                                  let newVehicleId = prev[draft.draftId]?.vehicleId ?? '';
                                  if (newDriverId) {
                                    const latest = getLatestVehicleForDriver(newDriverId, drivers, vehicles, assignedRoutes);
                                    if (latest && vehicles.some(v => v.id.toString() === latest || v.vehicleCode === latest)) {
                                      newVehicleId = latest;
                                    }
                                  }"""
content = content.replace(auto_old, auto_new)


# Also add saveVehicleForDriver to createRouteSession to capture Generated routes immediately
create_route_old = """  const createRouteSession = async (
    selectedBinIds: number[],
    vehicleId: string,
    driverId: string
  ) => {
    const vehicle = vehicles.find((v) => String(v.id) === vehicleId);"""

create_route_new = """  const createRouteSession = async (
    selectedBinIds: number[],
    vehicleId: string,
    driverId: string
  ) => {
    saveVehicleForDriver(driverId, vehicleId);
    const vehicle = vehicles.find((v) => String(v.id) === vehicleId);"""
content = content.replace(create_route_old, create_route_new)

with open('/Users/thanojbuddhima/Development/garbon/Garbo_web_dashboard/src/components/Map.tsx', 'w') as f:
    f.write(content)

