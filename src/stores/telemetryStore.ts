import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { SseGpsBatch, SseTelemetry, TruckStatus } from '../contracts';
import { applyTelemetry, type FleetLive, type TruckLive } from '../domain/telemetry/pipeline';

/** Telemetry normally arrives every 2 s; five missed ticks means the data on screen is old. */
export const STALE_AFTER_MS = 10_000;

interface TelemetryState {
  fleet: FleetLive;
  /** Client clock, for staleness: the server's timestamps are not comparable to ours. */
  lastTelemetryAt: number | null;
  ingest(message: SseTelemetry | SseGpsBatch, receivedAt: number): void;
}

// shortcut: one store update per SSE message (the server sends at most 2 per 2 s tick).
// If the source gets chattier, buffer messages and flush once per animation frame.
export const useTelemetryStore = create<TelemetryState>((set) => ({
  fleet: {},
  lastTelemetryAt: null,
  ingest: (message, receivedAt) =>
    set((state) => ({
      fleet: applyTelemetry(state.fleet, message),
      lastTelemetryAt: message.type === 'telemetry' ? receivedAt : state.lastTelemetryAt,
    })),
}));

export function isStale(lastTelemetryAt: number | null, now: number): boolean {
  return lastTelemetryAt !== null && now - lastTelemetryAt > STALE_AFTER_MS;
}

/** Sorted ids ("truck_2" before "truck_10"); only changes when a truck appears. */
export const useTruckIds = (): string[] =>
  useTelemetryStore(
    useShallow((state) =>
      Object.keys(state.fleet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    ),
  );

/** Re-renders only when this truck's object changes. */
export const useTruck = (id: string): TruckLive | undefined =>
  useTelemetryStore((state) => state.fleet[id]);

/** id → live status, for "which trucks can take a route". Stable while no status changes. */
export const useTruckStatuses = (): Record<string, TruckStatus> =>
  useTelemetryStore(
    useShallow((state) =>
      Object.fromEntries(Object.values(state.fleet).map((truck) => [truck.id, truck.status])),
    ),
  );
