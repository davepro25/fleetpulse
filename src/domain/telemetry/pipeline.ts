import type {
  FleetSnapshot,
  HistorySample,
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

/**
 * Gives trucks a baseline from GET /api/fleet before their first SSE reading. Without one, the
 * fuel check has nothing to compare against, so a 0 % glitch as the very first reading would be
 * accepted (and raise low fuel). Trucks that already have live readings are left alone.
 */
export function applySnapshot(fleet: FleetLive, snapshot: FleetSnapshot): FleetLive {
  const missing = snapshot.fleet.filter((truck) => !fleet[truck.id]);
  if (missing.length === 0) return fleet;

  const next: Record<string, TruckLive> = { ...fleet };
  for (const truck of missing) {
    const reading = { ...truck, truckId: truck.id, timestamp: snapshot.timestamp };
    next[truck.id] = advance(newTruck(reading), reading);
  }
  return next;
}

/**
 * Fills the charts of a newly opened truck from GET /history. Only points older than the live
 * samples are added: live readings are real, history is the server's reconstruction. History never
 * touches the path (its locations are random spread, not where the truck was).
 */
export function seedSamples(
  fleet: FleetLive,
  truckId: string,
  history: HistorySample[],
): FleetLive {
  const truck = fleet[truckId];
  if (!truck) return fleet;

  const oldestLive = truck.samples[0]?.timestamp ?? Infinity;
  const older = history
    .filter((point) => point.timestamp < oldestLive)
    .map(({ timestamp, speed, fuel, engineTemp }) => ({
      timestamp,
      // One point has no "previous good value", so an impossible speed becomes a gap.
      speed: checkSpeed(NO_VALUE, speed, timestamp, PROFILES.truck).value,
      fuel,
      engineTemp,
    }));

  if (older.length === 0) return fleet;
  return { ...fleet, [truckId]: { ...truck, samples: mergeByTimestamp(older, truck.samples) } };
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
    const group = groups.get(reading.truckId);
    if (group) {
      group.push(reading);
    } else {
      groups.set(reading.truckId, [reading]);
    }
  }
  return groups;
}

function mergeByTimestamp<T extends { timestamp: number }>(existing: T[], incoming: T[]): T[] {
  const merged = [...existing, ...incoming].sort((a, b) => a.timestamp - b.timestamp);
  return merged
    .filter((item, i) => i === 0 || item.timestamp !== merged[i - 1]!.timestamp)
    .slice(-BUFFER_CAP);
}
