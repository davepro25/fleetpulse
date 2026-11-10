import {
  RouteSchema,
  RoutesResponseSchema,
  type CreateRouteRequest,
  type Route,
  type RouteStatus,
} from '../contracts';
import { API, HEADER } from './endpoints';
import { api } from './http';

export async function fetchRoutes(signal?: AbortSignal): Promise<Route[]> {
  const { routes } = await api.get(API.routes, { signal }).json(RoutesResponseSchema);
  return routes;
}

export function createRoute(dispatcherId: string, route: CreateRouteRequest): Promise<Route> {
  return api
    .post(API.routes, { headers: { [HEADER.dispatcher]: dispatcherId }, json: route })
    .json(RouteSchema);
}

// Always sends If-Match: the server only checks the version when the header is present.
export function updateRouteStatus(
  dispatcherId: string,
  route: Pick<Route, 'id' | '_version'>,
  status: RouteStatus,
): Promise<Route> {
  return api
    .patch(API.route(route.id), {
      headers: { [HEADER.dispatcher]: dispatcherId, [HEADER.ifMatch]: String(route._version) },
      json: { status },
    })
    .json(RouteSchema);
}

export function reassignRoute(
  dispatcherId: string,
  routeId: string,
  newTruckId: string,
): Promise<Route> {
  return api
    .put(API.reassign(routeId), {
      headers: { [HEADER.dispatcher]: dispatcherId },
      json: { newTruckId },
    })
    .json(RouteSchema);
}
