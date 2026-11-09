import { FleetSnapshotSchema, type FleetSnapshot } from '../contracts';
import { API } from './endpoints';
import { api } from './http';

export function fetchFleet(signal?: AbortSignal): Promise<FleetSnapshot> {
  return api.get(API.fleet, { signal }).json(FleetSnapshotSchema);
}
