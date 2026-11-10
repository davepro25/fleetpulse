import { queryOptions, useQuery } from '@tanstack/react-query';
import { CircuitOpenError, PROBE_AFTER_MS } from '../api/circuit';
import { fetchFleet, fetchHistory, fetchTruckDetail } from '../api/fleet';
import { useTelemetryStore } from '../stores/telemetryStore';
import { QUERY_KEYS } from './keys';

// Not polled: SSE carries live state. Refetched on load, after reconnects and after fleet_reset.
const fleetQuery = queryOptions({
  queryKey: QUERY_KEYS.fleet,
  queryFn: async ({ signal }) => {
    const snapshot = await fetchFleet(signal);
    useTelemetryStore.getState().ingestSnapshot(snapshot);
    return snapshot;
  },
});

/** The banner's subscription. It alone probes an open circuit, so other readers don't multiply probes. */
export function useFleet() {
  return useQuery({
    ...fleetQuery,
    refetchInterval: (query) =>
      query.state.error instanceof CircuitOpenError ? PROBE_AFTER_MS : false,
  });
}

export function useTruckName(id: string): string {
  const { data } = useQuery({
    ...fleetQuery,
    select: (snapshot) => snapshot.fleet.find((truck) => truck.id === id)?.name,
  });
  return data ?? id;
}

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
