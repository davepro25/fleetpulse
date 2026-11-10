import { describe, expect, it } from 'vitest';
import { SseMessageSchema, type SseTelemetry, type TruckStatus } from '../src/contracts';
import { matchesFilter, SHOW_ALL, type FleetFilter } from '../src/domain/fleetFilter';
import { applyTelemetry, type TruckLive } from '../src/domain/telemetry/pipeline';
import sse from './fixtures/sse.json';

const BASE = (SseMessageSchema.parse(sse.telemetry) as SseTelemetry).readings[0]!;

const truck = (status: TruckStatus, fuel: number): TruckLive =>
  applyTelemetry(
    {},
    {
      type: 'telemetry',
      readings: [{ ...BASE, truckId: 'truck_1', status, fuel }],
      timestamp: BASE.timestamp,
    },
  )['truck_1']!;

const filter = (overrides: Partial<FleetFilter>): FleetFilter => ({ ...SHOW_ALL, ...overrides });

describe('fleet filter', () => {
  it('shows every truck when nothing is chosen', () => {
    expect(matchesFilter(truck('maintenance', 3), false, SHOW_ALL)).toBe(true);
  });

  it('filters by status', () => {
    expect(matchesFilter(truck('idle', 60), false, filter({ status: 'idle' }))).toBe(true);
    expect(matchesFilter(truck('active', 60), false, filter({ status: 'idle' }))).toBe(false);
  });

  it('filters by fuel level, using the trusted value so a 0 % glitch never counts as low', () => {
    const glitching = applyTelemetry(
      { truck_1: truck('active', 60) },
      {
        type: 'telemetry',
        readings: [{ ...BASE, truckId: 'truck_1', fuel: 0, timestamp: BASE.timestamp + 2000 }],
        timestamp: BASE.timestamp + 2000,
      },
    )['truck_1']!;

    expect(matchesFilter(truck('active', 10), false, filter({ fuelBelow: 15 }))).toBe(true);
    expect(matchesFilter(truck('active', 30), false, filter({ fuelBelow: 15 }))).toBe(false);
    expect(matchesFilter(glitching, false, filter({ fuelBelow: 15 }))).toBe(false);
  });

  it('filters by route assignment, and combines with the other filters', () => {
    const idleWithRoute = truck('idle', 60);

    expect(matchesFilter(idleWithRoute, true, filter({ route: 'assigned' }))).toBe(true);
    expect(matchesFilter(idleWithRoute, true, filter({ route: 'unassigned' }))).toBe(false);
    expect(matchesFilter(idleWithRoute, false, filter({ route: 'unassigned' }))).toBe(true);
    expect(
      matchesFilter(idleWithRoute, true, filter({ route: 'assigned', status: 'active' })),
    ).toBe(false);
  });
});
