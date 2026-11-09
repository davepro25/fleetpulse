import { queryOptions, useQuery } from '@tanstack/react-query';
import { FleetSnapshotSchema } from '../contracts';
import { getJson } from '../api/http';

// Not polled: SSE carries live state. Refetched on load, after reconnects and after fleet_reset.
export const fleetQueryOptions = queryOptions({
  queryKey: ['fleet'],
  queryFn: ({ signal }) => getJson('/api/fleet', FleetSnapshotSchema, signal),
});

/** id → display name. Telemetry has no names; until the snapshot loads, the id is shown. */
export function useTruckName(id: string): string {
  const { data } = useQuery({
    ...fleetQueryOptions,
    select: (snapshot) => snapshot.fleet.find((truck) => truck.id === id)?.name,
  });
  return data ?? id;
}
