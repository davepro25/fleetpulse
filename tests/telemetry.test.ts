import { describe, expect, it } from 'vitest';
import { SseMessageSchema, type SseGpsBatch, type SseTelemetry } from '../src/contracts';
import { checkSpeed, isLowFuel } from '../src/domain/telemetry/detectors';
import { applyTelemetry, BUFFER_CAP, type FleetLive } from '../src/domain/telemetry/pipeline';
import { PROFILES, type VehicleProfile } from '../src/domain/telemetry/profiles';
import sse from './fixtures/sse.json';

type Message = SseTelemetry | SseGpsBatch;

const parse = (raw: unknown) => SseMessageSchema.parse(raw) as Message;
const BASE = (parse(sse.telemetry) as SseTelemetry).readings[0]!;

/** One-truck telemetry frame built from a real captured reading. */
const frame = (overrides: Partial<typeof BASE>): SseTelemetry => {
  const reading = { ...BASE, truckId: 'truck_1', ...overrides };
  return { type: 'telemetry', readings: [reading], timestamp: reading.timestamp };
};

const run = (messages: Message[], fleet: FleetLive = {}) => messages.reduce(applyTelemetry, fleet);

describe('fuel sensor', () => {
  it('never shows or alerts on the real 0 % glitch captured from the server', () => {
    const { truckId, messages } = sse.fuelGlitchSequence;
    let fleet: FleetLive = {};

    for (const raw of messages) {
      fleet = applyTelemetry(fleet, parse(raw));
      const truck = fleet[truckId]!;
      const glitching =
        (raw as { readings: { truckId: string; fuel: number }[] }).readings.find(
          (r) => r.truckId === truckId,
        )!.fuel === 0;

      expect(truck.fuel.value).toBeGreaterThan(80);
      expect(truck.fuel.fault?.kind).toBe(glitching ? 'sudden_drop' : undefined);
      expect(isLowFuel(truck.fuel, PROFILES.truck)).toBe(false);
    }
  });

  it('accepts a sustained drop as real after the confirm window, then alerts', () => {
    const fleet = run(
      [0, 2, 4, 6, 8, 10, 12].map((s, i) => frame({ fuel: i === 0 ? 42 : 3, timestamp: s * 1000 })),
    );
    const before = run(
      [0, 2, 4, 6, 8].map((s, i) => frame({ fuel: i === 0 ? 42 : 3, timestamp: s * 1000 })),
    );

    expect(before.truck_1!.fuel).toMatchObject({
      value: 42,
      fault: { kind: 'sudden_drop', since: 2000 },
    });
    expect(fleet.truck_1!.fuel).toEqual({ value: 3, fault: null });
    expect(isLowFuel(fleet.truck_1!.fuel, PROFILES.truck)).toBe(true);
  });

  it('suspects the 0 % glitch on a tank at the server floor of 5 % (a drop of exactly 5)', () => {
    const fleet = run([frame({ fuel: 5, timestamp: 0 }), frame({ fuel: 0, timestamp: 2000 })]);

    expect(fleet.truck_1!.fuel).toMatchObject({ value: 5, fault: { kind: 'sudden_drop' } });
  });

  it('alerts on a gradual decline as soon as it crosses the threshold, with no fault', () => {
    const levels = [15.1, 15.05, 14.95];
    const fleet = run(levels.map((fuel, i) => frame({ fuel, timestamp: i * 2000 })));

    expect(fleet.truck_1!.fuel).toEqual({ value: 14.95, fault: null });
    expect(isLowFuel(fleet.truck_1!.fuel, PROFILES.truck)).toBe(true);
  });
});

describe('speed sensor', () => {
  it('flags the real stuck 999 on truck_7 and keeps showing the last plausible value', () => {
    const { truckId, messages } = sse.speedStuckSequence;
    let fleet: FleetLive = {};

    for (const raw of messages.slice(0, -1)) fleet = applyTelemetry(fleet, parse(raw));
    const stuck = fleet[truckId]!;
    expect(stuck.speed).toMatchObject({ value: 0, fault: { kind: 'out_of_range', raw: 999 } });
    expect(stuck.samples.at(-1)!.speed).toBeNull(); // charts show a gap, not a spike

    fleet = applyTelemetry(fleet, parse(messages.at(-1)));
    expect(fleet[truckId]!.speed.fault).toBeNull();
  });

  it('reads its limits from the vehicle profile, so a new vehicle type is config only', () => {
    const van: VehicleProfile = { ...PROFILES.truck, maxSpeedKmh: 40 };
    const clean = { value: 30, fault: null };

    expect(checkSpeed(clean, 50, 1, van).fault?.kind).toBe('out_of_range');
    expect(checkSpeed(clean, 50, 1, PROFILES.truck)).toEqual({ value: 50, fault: null });
    expect(checkSpeed(clean, 85, 1, PROFILES.truck).fault).toBeNull(); // batch jitter goes up to 85
    expect(checkSpeed(clean, -0.8, 1, PROFILES.truck).value).toBe(30);
  });
});

describe('ordering and batches', () => {
  it('a real gps_batch only extends the path: one truck, current position and samples unchanged', () => {
    const batch = parse(sse.gps_batch) as SseGpsBatch;
    const newest = Math.max(...batch.readings.map((r) => r.timestamp));
    const before = run([frame({ truckId: batch.truckId, timestamp: newest + 2000 })]);

    const after = applyTelemetry(before, batch);
    const truck = after[batch.truckId]!;

    expect(Object.keys(after)).toEqual([batch.truckId]);
    expect(truck.location).toEqual(before[batch.truckId]!.location);
    expect(truck.samples).toEqual(before[batch.truckId]!.samples);
    expect(truck.path).toHaveLength(batch.readings.length + 1);
    const times = truck.path.map((p) => p.timestamp);
    expect(times).toEqual(times.toSorted((a, b) => a - b));
  });

  it('a real out-of-order reading goes into the path but never becomes current', () => {
    const { previous, message } = sse.outOfOrder;
    const late = message.readings.find((r) => r.timestamp < message.timestamp)!;
    const fleet = run([parse(previous), parse(message)]);
    const truck = fleet[late.truckId]!;

    expect(truck.lastReadingAt).toBeGreaterThan(late.timestamp);
    expect(truck.location).not.toEqual(late.location);
    expect(truck.path.map((p) => p.timestamp)).toContain(late.timestamp);
  });

  it(`keeps only the newest ${BUFFER_CAP} points per truck`, () => {
    const fleet = run(Array.from({ length: 200 }, (_, i) => frame({ timestamp: i * 2000 })));

    expect(fleet.truck_1!.samples).toHaveLength(BUFFER_CAP);
    expect(fleet.truck_1!.path).toHaveLength(BUFFER_CAP);
    expect(fleet.truck_1!.samples[0]!.timestamp).toBe(50 * 2000);
  });
});
