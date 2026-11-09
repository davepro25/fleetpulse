import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { getJson } from '../api/http';
import { RoutesResponseSchema, type Route } from '../contracts';
import { lastActor } from '../domain/routes/conflicts';
import { useAuditStore } from '../stores/auditStore';

export const routesQueryOptions = queryOptions({
  queryKey: ['routes'],
  queryFn: async ({ signal }) =>
    (await getJson('/api/routes', RoutesResponseSchema, signal)).routes,
});

/**
 * The single way a route change enters the app: our own mutation results and WS route events
 * both come through here. The version check makes the second copy of the same change a no-op,
 * and the route itself says who changed it last (assignedBy / lastModifiedBy / reassignedBy).
 */
export function applyRouteChange(client: QueryClient, route: Route): void {
  const routes = client.getQueryData(routesQueryOptions.queryKey);
  const previous = routes?.find((r) => r.id === route.id);

  // Before the first fetch there is no list to patch, and that fetch will include this route.
  if (routes) client.setQueryData(routesQueryOptions.queryKey, upsertRoute(routes, route));

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
