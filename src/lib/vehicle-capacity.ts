/** Default bin capacity when vehicle has no maxBins or legacy capacity value. */
export const DEFAULT_VEHICLE_MAX_BINS = 25;

export interface VehicleCapacityFields {
  maxBins?: number | null;
  capacity?: number | null;
}

/** Resolve how many bins a vehicle can collect in one trip (prefers maxBins over legacy capacity). */
export function getVehicleMaxBins(vehicle: VehicleCapacityFields): number {
  if (vehicle.maxBins != null && vehicle.maxBins > 0) return vehicle.maxBins;
  if (vehicle.capacity != null && vehicle.capacity > 0) return Math.round(vehicle.capacity);
  return DEFAULT_VEHICLE_MAX_BINS;
}

export function vehicleCapacityLabel(vehicle: VehicleCapacityFields): string {
  const bins = getVehicleMaxBins(vehicle);
  return `${bins} bins`;
}

export function isVehicleCapacitySufficient(
  vehicle: VehicleCapacityFields,
  requiredBins: number
): boolean {
  return getVehicleMaxBins(vehicle) >= requiredBins;
}
