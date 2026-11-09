import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { createRoute, reassignRoute, updateRouteStatus } from '../api/routes';
import type { CreateRouteRequest, Route, RouteStatus } from '../contracts';
import { useApp } from '../context/AppContext';
import { conflictOwner, type ConflictOwner } from '../domain/routes/conflicts';
import { applyRouteChange, routesQueryOptions } from '../queries/routes';
import { displayName } from '../utils/identity';

export class RouteConflictError extends Error {
  readonly owner: ConflictOwner;

  constructor(owner: ConflictOwner) {
    super('Route conflict');
    this.name = 'RouteConflictError';
    this.owner = owner;
  }
}

// No optimistic update and no automatic retry: on a 409 the dispatcher sees who changed what and
// decides again with the fresh data. The refetch also brings every panel up to date.
async function withConflictLookup<T>(
  client: QueryClient,
  subject: { routeId: string } | { truckId: string },
  call: () => Promise<T>,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof HTTPError) || error.response.status !== 409) throw error;
    const fresh = await client.fetchQuery({ ...routesQueryOptions, staleTime: 0 });
    throw new RouteConflictError(conflictOwner(fresh, subject));
  }
}

export function useCreateRoute() {
  const client = useQueryClient();
  const { identity } = useApp();
  return useMutation({
    mutationFn: (input: CreateRouteRequest) =>
      withConflictLookup(client, { truckId: input.truckId }, () => createRoute(identity.id, input)),
    onSuccess: (route) => applyRouteChange(client, route),
  });
}

export function useUpdateRouteStatus() {
  const client = useQueryClient();
  const { identity } = useApp();
  return useMutation({
    /** `version` is the one the dispatcher saw when deciding, sent as If-Match. */
    mutationFn: ({
      routeId,
      version,
      status,
    }: {
      routeId: string;
      version: number;
      status: RouteStatus;
    }) =>
      withConflictLookup(client, { routeId }, () =>
        updateRouteStatus(identity.id, { id: routeId, _version: version }, status),
      ),
    onSuccess: (route) => applyRouteChange(client, route),
  });
}

export function useReassignRoute() {
  const client = useQueryClient();
  const { identity } = useApp();
  return useMutation({
    mutationFn: ({ route, truckId }: { route: Route; truckId: string }) =>
      withConflictLookup(client, { truckId }, () => reassignRoute(identity.id, route.id, truckId)),
    onSuccess: (route) => applyRouteChange(client, route),
  });
}

/** One sentence for the dispatcher. Server error strings are shown as text, never as HTML. */
export function mutationErrorMessage(error: unknown, selfId: string): string {
  if (error instanceof RouteConflictError) {
    const { route, actor } = error.owner;
    if (!route || !actor)
      return 'Not applied: the route changed meanwhile. The list is now up to date.';
    const who = actor.dispatcherId === selfId ? 'you' : displayName(actor.dispatcherId);
    const when = new Date(actor.at).toLocaleTimeString();
    return `Not applied: ${route.id} was ${actor.action} by ${who} at ${when}. The list is now up to date.`;
  }
  if (error instanceof HTTPError) {
    const body = error.data as { error?: unknown } | undefined;
    return `Not applied: ${typeof body?.error === 'string' ? body.error : `server error ${error.response.status}`}.`;
  }
  return 'Not applied: no connection to the server. Try again.';
}
