import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { createRoute, reassignRoute, updateRouteStatus } from '../api/routes';
import type { CreateRouteRequest, Route, RouteStatus } from '../contracts';
import { useSession } from '../context/SessionContext';
import { conflictOwner, type ConflictOwner } from '../domain/routes/conflicts';
import { applyRouteChange, refetchRoutes } from '../queries/routes';

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
    const fresh = await refetchRoutes(client);
    throw new RouteConflictError(conflictOwner(fresh, subject));
  }
}

export function useCreateRoute() {
  const client = useQueryClient();
  const { identity } = useSession();
  return useMutation({
    mutationFn: (input: CreateRouteRequest) =>
      withConflictLookup(client, { truckId: input.truckId }, () => createRoute(identity.id, input)),
    onSuccess: (route) => applyRouteChange(client, route),
  });
}

export function useUpdateRouteStatus() {
  const client = useQueryClient();
  const { identity } = useSession();
  return useMutation({
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
  const { identity } = useSession();
  return useMutation({
    mutationFn: ({ route, truckId }: { route: Route; truckId: string }) =>
      withConflictLookup(client, { truckId }, () => reassignRoute(identity.id, route.id, truckId)),
    onSuccess: (route) => applyRouteChange(client, route),
  });
}
