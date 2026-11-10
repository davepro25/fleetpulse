import { describe, expect, it } from 'vitest';
import { HistoryResponseSchema, SseMessageSchema, type SseTelemetry } from '../src/contracts';
import { validateAlert } from '../src/domain/alerts';
import { applyTelemetry, BUFFER_CAP, seedSamples } from '../src/domain/telemetry/pipeline';
import rest from './fixtures/rest.json';
import sse from './fixtures/sse.json';

const BASE = (SseMessageSchema.parse(sse.telemetry) as SseTelemetry).readings[0]!;
const HISTORY = HistoryResponseSchema.parse(rest.history.body).history;

const liveTruck = (timestamp: number) =>
  applyTelemetry(
    {},
    {
      type: 'telemetry',
      readings: [{ ...BASE, truckId: 'truck_1', timestamp }],
      timestamp,
    },
  );

describe('seedSamples', () => {
  it('adds only history older than the live samples, in order, and never touches the path', () => {
    const newestHistory = HISTORY.at(-1)!.timestamp;
    const fleet = liveTruck(newestHistory - 1); // the last history point overlaps live data
    const seeded = seedSamples(fleet, 'truck_1', HISTORY)['truck_1']!;

    const times = seeded.samples.map((s) => s.timestamp);
    expect(times).toEqual(times.toSorted((a, b) => a - b));
    expect(times).not.toContain(newestHistory);
    expect(seeded.samples).toHaveLength(HISTORY.length); // all but one history point, plus live
    expect(seeded.path).toBe(fleet['truck_1']!.path);
  });

  it('hides an impossible history speed as a gap and keeps the buffer cap', () => {
    const fleet = liveTruck(Number.MAX_SAFE_INTEGER);
    const long = Array.from({ length: 200 }, (_, i) => ({ ...HISTORY[0]!, timestamp: i }));
    long[199] = { ...long[199]!, speed: 999 };

    const seeded = seedSamples(fleet, 'truck_1', long)['truck_1']!;
    expect(seeded.samples).toHaveLength(BUFFER_CAP);
    expect(seeded.samples.at(-1)!.timestamp).toBe(Number.MAX_SAFE_INTEGER); // live kept first
    expect(seeded.samples.at(-2)!.speed).toBeNull();
  });

  it('returns the same fleet for an unknown truck or nothing new', () => {
    const fleet = liveTruck(0);
    expect(seedSamples(fleet, 'truck_99', HISTORY)).toBe(fleet);
    expect(seedSamples(fleet, 'truck_1', HISTORY)).toBe(fleet); // all history is newer than 0
  });
});

describe('validateAlert', () => {
  it('trims the message and accepts a known severity', () => {
    expect(validateAlert({ message: '  Check tyres ', severity: 'warning' })).toEqual({
      ok: true,
      value: { message: 'Check tyres', severity: 'warning' },
    });
  });

  it('rejects an empty or too long message and an unknown severity', () => {
    const result = validateAlert({ message: ' ', severity: 'urgent' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['message', 'severity']);
    expect(validateAlert({ message: 'x'.repeat(201), severity: 'info' }).ok).toBe(false);
  });
});
