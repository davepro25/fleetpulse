import { z } from 'zod';
import { LatLngSchema, TruckStatusSchema } from './fleet';

// z.object strips unknown keys, so the mock's debug flags (_reordered, _batch*) never reach the app.
export const TelemetryReadingSchema = z.object({
  truckId: z.string(),
  location: LatLngSchema,
  speed: z.number(),
  heading: z.number(),
  fuel: z.number(),
  engineTemp: z.number(),
  status: TruckStatusSchema,
  timestamp: z.number(),
});
export type TelemetryReading = z.infer<typeof TelemetryReadingSchema>;

// Drop only the malformed readings, so one bad sensor can't blank out the other trucks.
const validReadings = z.array(z.unknown()).transform((items) =>
  items.flatMap((item) => {
    const reading = TelemetryReadingSchema.safeParse(item);
    return reading.success ? [reading.data] : [];
  }),
);

const SseConnectedSchema = z.object({
  type: z.literal('connected'),
  truckCount: z.number(),
  timestamp: z.number(),
});

const SseHeartbeatSchema = z.object({
  type: z.literal('heartbeat'),
  timestamp: z.number(),
});

const SseTelemetrySchema = z.object({
  type: z.literal('telemetry'),
  readings: validReadings,
  timestamp: z.number(),
});

// Buffered readings 2-58 s old: path history only, never the current position.
const SseGpsBatchSchema = z.object({
  type: z.literal('gps_batch'),
  truckId: z.string(),
  readings: validReadings,
});

export const SseMessageSchema = z.discriminatedUnion('type', [
  SseConnectedSchema,
  SseHeartbeatSchema,
  SseTelemetrySchema,
  SseGpsBatchSchema,
]);
export type SseMessage = z.infer<typeof SseMessageSchema>;
export type SseTelemetry = z.infer<typeof SseTelemetrySchema>;
export type SseGpsBatch = z.infer<typeof SseGpsBatchSchema>;

// Synthetic data: good for seeding charts, never drawn on the map.
export const HistorySampleSchema = z.object({
  truckId: z.string(),
  location: LatLngSchema,
  speed: z.number(),
  fuel: z.number(),
  engineTemp: z.number(),
  timestamp: z.number(),
});
export type HistorySample = z.infer<typeof HistorySampleSchema>;

export const HistoryResponseSchema = z.object({
  history: z.array(HistorySampleSchema),
  count: z.number(),
});
