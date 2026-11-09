import { RouteSchema, type CreateRouteRequest, type Route, type RouteStatus } from '../contracts';
import { sendJson } from './http';

export function createRoute(dispatcherId: string, body: CreateRouteRequest): Promise<Route> {
  return sendJson('post', '/api/routes', { dispatcherId, body }, RouteSchema);
}

// Always sends If-Match: the server only checks the version when the header is present.
export function updateRouteStatus(
  dispatcherId: string,
  route: Pick<Route, 'id' | '_version'>,
  status: RouteStatus,
): Promise<Route> {
  return sendJson(
    'patch',
    `/api/routes/${encodeURIComponent(route.id)}`,
    { dispatcherId, ifMatch: route._version, body: { status } },
    RouteSchema,
  );
}

export function reassignRoute(
  dispatcherId: string,
  routeId: string,
  newTruckId: string,
): Promise<Route> {
  return sendJson(
    'put',
    `/api/routes/${encodeURIComponent(routeId)}/reassign`,
    { dispatcherId, body: { newTruckId } },
    RouteSchema,
  );
}
