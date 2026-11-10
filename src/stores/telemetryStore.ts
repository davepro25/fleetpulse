import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type {
  FleetSnapshot,
  HistorySample,
  SseGpsBatch,
  SseTelemetry,
  TruckStatus,
} from '../contracts';
import { trackAnomalies, type SensorAnomaly } from '../domain/telemetry/anomalies';
import {
  applySnapshot,
  applyTelemetry,
  seedSamples,
  type FleetLive,
  type TruckLive,
} from '../domain/telemetry/pipeline';

export const STALE_AFTER_MS = 10_000;

interface TelemetryState {
  fleet: FleetLive;
  /** Client clock, for staleness: the server's timestamps are not comparable to ours. */
  lastTelemetryAt: number | null;
  anomalies: SensorAnomaly[];
  ingest(message: SseTelemetry | SseGpsBatch, receivedAt: number): void;
  ingestSnapshot(snapshot: FleetSnapshot): void;
  seed(truckId: string, history: HistorySample[]): void;
  reset(): void;
}

// shortcut: one store update per SSE message (the server sends at most 2 per 2 s tick).
// If the source gets chattier, buffer messages and flush once per animation frame.
export const useTelemetryStore = create<TelemetryState>((set) => ({
  fleet: {},
  lastTelemetryAt: null,
  anomalies: [],
  ingest: (message, receivedAt) =>
    set((state) => {
      const fleet = applyTelemetry(state.fleet, message);
      return {
        fleet,
        anomalies: trackAnomalies(state.anomalies, state.fleet, fleet),
        lastTelemetryAt: message.type === 'telemetry' ? receivedAt : state.lastTelemetryAt,
      };
    }),
  ingestSnapshot: (snapshot) => set((state) => ({ fleet: applySnapshot(state.fleet, snapshot) })),
  seed: (truckId, history) =>
    set((state) => ({ fleet: seedSamples(state.fleet, truckId, history) })),
  reset: () => set({ fleet: {}, anomalies: [] }),
}));

export function isStale(lastTelemetryAt: number | null, now: number): boolean {
  return lastTelemetryAt !== null && now - lastTelemetryAt > STALE_AFTER_MS;
}

export const useTruckIds = (): string[] =>
  useTelemetryStore(
    useShallow((state) =>
      Object.keys(state.fleet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    ),
  );

export const useTruck = (id: string): TruckLive | undefined =>
  useTelemetryStore((state) => state.fleet[id]);

export const useTruckStatuses = (): Record<string, TruckStatus> =>
  useTelemetryStore(
    useShallow((state) =>
      Object.fromEntries(Object.values(state.fleet).map((truck) => [truck.id, truck.status])),
    ),
  );
