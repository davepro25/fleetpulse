import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';
import { fetchRoutes } from '../api/routes';
import type { Route } from '../contracts';
import { lastActor } from '../domain/routes/conflicts';
import { isActive } from '../domain/routes/transitions';
import { useAuditStore } from '../stores/auditStore';
import { QUERY_KEYS } from './keys';

const routesQuery = queryOptions({
  queryKey: QUERY_KEYS.routes,
  queryFn: ({ signal }) => fetchRoutes(signal),
});

export function useRoutes() {
  return useQuery(routesQuery);
}

export function useActiveRouteCount(): number {
  return useQuery({ ...routesQuery, select: (routes) => routes.filter(isActive).length }).data ?? 0;
}

export function refetchRoutes(client: QueryClient): Promise<Route[]> {
  return client.fetchQuery({ ...routesQuery, staleTime: 0 });
}

/**
 * The single way a route change enters the app: our own mutation results and WS route events
 * both come through here. The version check makes the second copy of the same change a no-op,
 * and the route itself says who changed it last (assignedBy / lastModifiedBy / reassignedBy).
 */
export function applyRouteChange(client: QueryClient, route: Route): void {
  const routes = client.getQueryData(routesQuery.queryKey);
  const previous = routes?.find((r) => r.id === route.id);

  // Before the first fetch there is no list to patch, and that fetch will include this route.
  if (routes) client.setQueryData(routesQuery.queryKey, upsertRoute(routes, route));

  const actor = lastActor(route);
  useAuditStore.getState().record({
    key: `${route.id}@${route._version}`,
    routeId: route.id,
    kind: actor.action,
    actor: actor.dispatcherId,
    at: actor.at,
    truckId: route.truckId,
    status: route.status,
    ...(previous && { previous: { truckId: previous.truckId, status: previous.status } }),
  });
}

function upsertRoute(routes: Route[], next: Route): Route[] {
  const existing = routes.find((r) => r.id === next.id);
  if (!existing) return [...routes, next];
  if (existing._version >= next._version) return routes;
  return routes.map((r) => (r.id === next.id ? next : r));
}
