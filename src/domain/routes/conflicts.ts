import type { Route } from '../../contracts';
import { activeRouteForTruck } from './transitions';

export interface Actor {
  dispatcherId: string;
  action: 'assigned' | 'updated' | 'reassigned';
  at: number;
}

export function lastActor(route: Route): Actor {
  const candidates: (Actor | null)[] = [
    { dispatcherId: route.assignedBy, action: 'assigned', at: route.assignedAt },
    route.lastModifiedBy && route.lastModifiedAt
      ? { dispatcherId: route.lastModifiedBy, action: 'updated', at: route.lastModifiedAt }
      : null,
    route.reassignedBy && route.reassignedAt
      ? { dispatcherId: route.reassignedBy, action: 'reassigned', at: route.reassignedAt }
      : null,
  ];
  return candidates
    .filter((actor): actor is Actor => actor !== null)
    .reduce((latest, actor) => (actor.at > latest.at ? actor : latest));
}

export interface ConflictOwner {
  route: Route | undefined;
  actor: Actor | null;
}

/**
 * Who caused a 409, read from a freshly fetched routes list. Never from the 409 body: its
 * lastModifiedBy ignores reassigns, the processing-409 has no actor and the reassign-409 none.
 * `routeId` for a status change, `truckId` for a create or reassign onto a busy truck.
 */
export function conflictOwner(
  routes: Route[],
  subject: { routeId: string } | { truckId: string },
): ConflictOwner {
  const route =
    'routeId' in subject
      ? routes.find((r) => r.id === subject.routeId)
      : activeRouteForTruck(routes, subject.truckId);
  return { route, actor: route ? lastActor(route) : null };
}
