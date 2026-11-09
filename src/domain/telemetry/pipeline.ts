import type {
  LatLng,
  SseGpsBatch,
  SseTelemetry,
  TelemetryReading,
  TruckStatus,
} from '../../contracts';
import { checkFuel, checkSpeed, NO_VALUE, type SensorValue } from './detectors';
import { PROFILES } from './profiles';

/** 5 minutes of readings at one per 2 s, with room for a 29-point batch. */
export const BUFFER_CAP = 150;

export interface Sample {
  timestamp: number;
  speed: number | null; // null while the sensor is faulted: charts show a gap
  fuel: number | null;
  engineTemp: number;
}

export interface PathPoint extends LatLng {
  timestamp: number;
}

export interface TruckLive {
  id: string;
  status: TruckStatus;
  location: LatLng;
  heading: number;
  engineTemp: number;
  lastReadingAt: number;
  speed: SensorValue;
  fuel: SensorValue;
  samples: Sample[];
  path: PathPoint[];
}

export type FleetLive = Readonly<Record<string, TruckLive>>;

/**
 * Only a reading newer than the truck's current one becomes current (ordering by sensor
 * timestamp, never by arrival). Late readings and gps_batch readings only extend the path.
 */
export function applyTelemetry(fleet: FleetLive, message: SseTelemetry | SseGpsBatch): FleetLive {
  const next: Record<string, TruckLive> = { ...fleet };
  for (const [truckId, readings] of groupByTruck(message.readings)) {
    const updated = applyReadings(fleet[truckId], readings, message.type === 'gps_batch');
    if (updated) next[truckId] = updated;
  }
  return next;
}

function applyReadings(
  truck: TruckLive | undefined,
  readings: TelemetryReading[],
  isBatch: boolean,
): TruckLive | undefined {
  let current = truck;
  for (const reading of readings.toSorted((a, b) => a.timestamp - b.timestamp)) {
    if (isBatch || (current && reading.timestamp <= current.lastReadingAt)) continue;
    current = advance(current ?? newTruck(reading), reading);
  }
  // A batch for a truck we have never seen live has no current position to attach to.
  if (!current) return undefined;

  const points = readings.map(({ timestamp, location }) => ({ timestamp, ...location }));
  return { ...current, path: mergeByTimestamp(current.path, points) };
}

function advance(truck: TruckLive, reading: TelemetryReading): TruckLive {
  const profile = PROFILES.truck;
  const speed = checkSpeed(truck.speed, reading.speed, reading.timestamp, profile);
  const fuel = checkFuel(truck.fuel, reading.fuel, reading.timestamp, profile);
  const sample: Sample = {
    timestamp: reading.timestamp,
    speed: speed.fault ? null : speed.value,
    fuel: fuel.fault ? null : fuel.value,
    engineTemp: reading.engineTemp,
  };

  return {
    ...truck,
    status: reading.status,
    location: reading.location,
    heading: reading.heading,
    engineTemp: reading.engineTemp,
    lastReadingAt: reading.timestamp,
    speed,
    fuel,
    samples: mergeByTimestamp(truck.samples, [sample]),
  };
}

function newTruck(reading: TelemetryReading): TruckLive {
  return {
    id: reading.truckId,
    status: reading.status,
    location: reading.location,
    heading: reading.heading,
    engineTemp: reading.engineTemp,
    lastReadingAt: -Infinity,
    speed: NO_VALUE,
    fuel: NO_VALUE,
    samples: [],
    path: [],
  };
}

function groupByTruck(readings: TelemetryReading[]): Map<string, TelemetryReading[]> {
  const groups = new Map<string, TelemetryReading[]>();
  for (const reading of readings) {
    groups.set(reading.truckId, [...(groups.get(reading.truckId) ?? []), reading]);
  }
  return groups;
}

/** Sorted by timestamp, one item per timestamp, newest BUFFER_CAP kept. */
function mergeByTimestamp<T extends { timestamp: number }>(existing: T[], incoming: T[]): T[] {
  const merged = [...existing, ...incoming].sort((a, b) => a.timestamp - b.timestamp);
  return merged
    .filter((item, i) => i === 0 || item.timestamp !== merged[i - 1]!.timestamp)
    .slice(-BUFFER_CAP);
}
