import type { Route, RouteStatus, TruckStatus } from '../../contracts';

// The server accepts any status change; the client enforces the lifecycle.
const NEXT_STATUS: Record<RouteStatus, readonly RouteStatus[]> = {
  assigned: ['in-progress', 'cancelled'],
  'in-progress': ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function nextStatuses(from: RouteStatus): readonly RouteStatus[] {
  return NEXT_STATUS[from];
}

export function isActive(route: Route): boolean {
  return route.status === 'assigned' || route.status === 'in-progress';
}

// Derived from the routes list, not from the fleet snapshot's currentRouteId, which goes stale.
export function activeRouteForTruck(routes: Route[], truckId: string): Route | undefined {
  return routes.find((route) => route.truckId === truckId && isActive(route));
}

// POST /api/routes does not reject maintenance trucks (it even sets them active), so we must.
export function assignableTruckIds(
  statuses: Record<string, TruckStatus>,
  routes: Route[],
): string[] {
  return Object.keys(statuses).filter(
    (id) => statuses[id] !== 'maintenance' && !activeRouteForTruck(routes, id),
  );
}

// PUT /reassign has no If-Match and no status check on the server, so these checks are ours.
export function reassignBlockedReason(
  route: Route,
  targetId: string,
  statuses: Record<string, TruckStatus>,
  routes: Route[],
): string | null {
  if (!isActive(route)) return `Route is already ${route.status}`;
  if (targetId === route.truckId) return 'Route is already on the same truck';
  if (statuses[targetId] === 'maintenance') return 'Truck is in maintenance';
  if (activeRouteForTruck(routes, targetId)) return 'Truck already has a route';
  return null;
}
