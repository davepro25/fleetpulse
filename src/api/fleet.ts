import {
  FleetSnapshotSchema,
  HistoryResponseSchema,
  TruckAlertSchema,
  TruckDetailSchema,
  type FleetSnapshot,
  type HistorySample,
  type SendAlertRequest,
  type TruckAlert,
  type TruckDetail,
} from '../contracts';
import { BUFFER_CAP } from '../domain/telemetry/pipeline';
import { circuitBreakerHooks } from './circuit';
import { API, HEADER } from './endpoints';
import { api } from './http';

// Bonus: GET /api/fleet is the endpoint that answers 503 under load (quirk 7).
const fleetCircuit = circuitBreakerHooks();

export function fetchFleet(signal?: AbortSignal): Promise<FleetSnapshot> {
  return api.get(API.fleet, { signal, hooks: fleetCircuit }).json(FleetSnapshotSchema);
}

// The only endpoint with mileage.
export function fetchTruckDetail(truckId: string, signal?: AbortSignal): Promise<TruckDetail> {
  return api.get(API.truck(truckId), { signal }).json(TruckDetailSchema);
}

// As many points as the charts keep, so a newly opened truck has full charts at once.
export async function fetchHistory(
  truckId: string,
  signal?: AbortSignal,
): Promise<HistorySample[]> {
  const { history } = await api
    .get(API.history(truckId), { signal, searchParams: { limit: BUFFER_CAP } })
    .json(HistoryResponseSchema);
  return history;
}

export function sendAlert(
  dispatcherId: string,
  truckId: string,
  alert: SendAlertRequest,
): Promise<TruckAlert> {
  return api
    .post(API.alert(truckId), { headers: { [HEADER.dispatcher]: dispatcherId }, json: alert })
    .json(TruckAlertSchema);
}
