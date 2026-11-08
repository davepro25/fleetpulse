import { queryOptions } from '@tanstack/react-query';
import { FleetSnapshotSchema } from '../contracts';
import { getJson } from '../api/http';

// Not polled: SSE carries live state. Refetched on load, after reconnects and after fleet_reset.
export const fleetQueryOptions = queryOptions({
  queryKey: ['fleet'],
  queryFn: ({ signal }) => getJson('/api/fleet', FleetSnapshotSchema, signal),
});
