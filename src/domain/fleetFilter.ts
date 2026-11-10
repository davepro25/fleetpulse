import type { TruckStatus } from '../contracts';
import type { TruckLive } from './telemetry/pipeline';

export interface FleetFilter {
  status: TruckStatus | 'all';
  fuelBelow: number | null;
  route: 'all' | 'assigned' | 'unassigned';
}

export const SHOW_ALL: FleetFilter = { status: 'all', fuelBelow: null, route: 'all' };

export function isFiltering(filter: FleetFilter): boolean {
  return filter.status !== 'all' || filter.fuelBelow !== null || filter.route !== 'all';
}

// Fuel uses the trusted value, so a truck in the middle of a 0 % glitch never shows up as low.
export function matchesFilter(truck: TruckLive, hasRoute: boolean, filter: FleetFilter): boolean {
  if (filter.status !== 'all' && truck.status !== filter.status) {
    return false;
  }

  if (filter.fuelBelow !== null) {
    const fuel = truck.fuel.value;
    if (fuel === null || fuel >= filter.fuelBelow) return false;
  }

  if (filter.route === 'assigned' && !hasRoute) {
    return false;
  }

  if (filter.route === 'unassigned' && hasRoute) {
    return false;
  }

  return true;
}
