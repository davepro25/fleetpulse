// SSE GET /api/telemetry/stream (all frames are unnamed `data:` events) and the history endpoint.
// Debug fields the mock adds (_reordered, _batch*) are deliberately absent: a real sensor
// would not send them, so nothing may depend on them.
import type { LatLng, TruckStatus } from './fleet';

export interface TelemetryReading {
  truckId: string;
  location: LatLng;
  speed: number;
  heading: number;
  fuel: number;
  engineTemp: number;
  status: TruckStatus;
  /** Sensor time (server clock). The only valid ordering key, never arrival order. */
  timestamp: number;
}

export interface SseConnected { type: 'connected'; truckCount: number; timestamp: number }
export interface SseHeartbeat { type: 'heartbeat'; timestamp: number }
export interface SseTelemetry { type: 'telemetry'; readings: TelemetryReading[]; timestamp: number }
/** Buffered past readings for one truck (2-58 s old). Path history only, never "current". */
export interface SseGpsBatch { type: 'gps_batch'; truckId: string; readings: TelemetryReading[] }

export type SseMessage = SseConnected | SseHeartbeat | SseTelemetry | SseGpsBatch;

/** GET /api/telemetry/history/:truckId item. Synthetic: chart seeding only, never the map. */
export interface HistorySample {
  truckId: string;
  location: LatLng;
  speed: number;
  fuel: number;
  engineTemp: number;
  timestamp: number;
}

export interface HistoryResponse { history: HistorySample[]; count: number }
