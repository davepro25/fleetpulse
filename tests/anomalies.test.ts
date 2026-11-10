import { describe, expect, it } from 'vitest';
import { SseMessageSchema, type SseTelemetry } from '../src/contracts';
import { trackAnomalies, type SensorAnomaly } from '../src/domain/telemetry/anomalies';
import { applyTelemetry, type FleetLive } from '../src/domain/telemetry/pipeline';
import sse from './fixtures/sse.json';

const parse = (raw: unknown) => SseMessageSchema.parse(raw) as SseTelemetry;
const BASE = parse(sse.telemetry).readings[0]!;

/** Feeds messages through the pipeline the way the store does, keeping the anomaly log. */
function replay(messages: SseTelemetry[]) {
  let fleet: FleetLive = {};
  let log: SensorAnomaly[] = [];
  for (const message of messages) {
    const next = applyTelemetry(fleet, message);
    log = trackAnomalies(log, fleet, next);
    fleet = next;
  }
  return log;
}

const fuelFrames = (levels: number[]) =>
  levels.map((fuel, i): SseTelemetry => {
    const reading = { ...BASE, truckId: 'truck_1', fuel, timestamp: i * 2000 };
    return { type: 'telemetry', readings: [reading], timestamp: reading.timestamp };
  });

describe('anomaly log', () => {
  it('records the real 0 % fuel glitch as a sensor glitch once it recovers', () => {
    const log = replay(sse.fuelGlitchSequence.messages.map(parse));
    const fuel = log.filter((a) => a.truckId === sse.fuelGlitchSequence.truckId);

    expect(fuel).toHaveLength(1);
    expect(fuel[0]).toMatchObject({ sensor: 'fuel', raw: 0, outcome: 'sensor_glitch' });
    expect(fuel[0]!.until).toBeGreaterThan(fuel[0]!.since);
  });

  it('keeps the real stuck 999 ongoing until speed is plausible again', () => {
    const messages = sse.speedStuckSequence.messages.map(parse);
    const mine = (log: SensorAnomaly[]) =>
      log.filter((a) => a.truckId === sse.speedStuckSequence.truckId);

    expect(mine(replay(messages.slice(0, -1)))).toMatchObject([
      { sensor: 'speed', raw: 999, outcome: 'ongoing', until: null },
    ]);
    expect(mine(replay(messages))).toMatchObject([{ sensor: 'speed', outcome: 'sensor_glitch' }]);
  });

  it('marks a fuel drop that holds past the confirm window as a real problem', () => {
    const log = replay(fuelFrames([42, 3, 3, 3, 3, 3, 3]));

    expect(log).toMatchObject([
      { sensor: 'fuel', raw: 3, lastGood: 42, outcome: 'confirmed', since: 2000, until: 12000 },
    ]);
  });

  it('returns the same log when no fault starts or ends', () => {
    const fleet = applyTelemetry({}, fuelFrames([42])[0]!);
    const next = applyTelemetry(fleet, fuelFrames([42, 41.9])[1]!);
    const log: SensorAnomaly[] = [];

    expect(trackAnomalies(log, fleet, next)).toBe(log);
  });
});
