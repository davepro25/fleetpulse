import { queryOptions, useQuery } from '@tanstack/react-query';
import { CircuitOpenError, PROBE_AFTER_MS } from '../api/circuit';
import { fetchFleet, fetchHistory, fetchTruckDetail } from '../api/fleet';
import { QUERY_KEYS } from './keys';

// Not polled: SSE carries live state. Refetched on load, after reconnects and after fleet_reset.
const fleetQuery = queryOptions({
  queryKey: QUERY_KEYS.fleet,
  queryFn: ({ signal }) => fetchFleet(signal),
});

/** The banner's subscription. It alone probes an open circuit, so other readers don't multiply probes. */
export function useFleet() {
  return useQuery({
    ...fleetQuery,
    refetchInterval: (query) =>
      query.state.error instanceof CircuitOpenError ? PROBE_AFTER_MS : false,
  });
}

/** id → display name. Telemetry has no names; until the snapshot loads, the id is shown. */
export function useTruckName(id: string): string {
  const { data } = useQuery({
    ...fleetQuery,
    select: (snapshot) => snapshot.fleet.find((truck) => truck.id === id)?.name,
  });
  return data ?? id;
}

// Fetched when a truck is opened. Mileage does not change in the simulation, so no polling.
export function useTruckDetail(truckId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.truck(truckId),
    queryFn: ({ signal }) => fetchTruckDetail(truckId, signal),
  });
}

export function useTelemetryHistory(truckId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.history(truckId),
    queryFn: ({ signal }) => fetchHistory(truckId, signal),
  });
}
