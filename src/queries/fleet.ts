import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchFleet } from '../api/fleet';
import { QUERY_KEYS } from './keys';

// Not polled: SSE carries live state. Refetched on load, after reconnects and after fleet_reset.
const fleetQuery = queryOptions({
  queryKey: QUERY_KEYS.fleet,
  queryFn: ({ signal }) => fetchFleet(signal),
});

export function useFleet() {
  return useQuery(fleetQuery);
}

/** id → display name. Telemetry has no names; until the snapshot loads, the id is shown. */
export function useTruckName(id: string): string {
  const { data } = useQuery({
    ...fleetQuery,
    select: (snapshot) => snapshot.fleet.find((truck) => truck.id === id)?.name,
  });
  return data ?? id;
}
