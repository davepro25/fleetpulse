import { create } from 'zustand';
import type { SseGpsBatch, SseTelemetry } from '../contracts';
import { applyTelemetry, type FleetLive } from '../domain/telemetry/pipeline';

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
