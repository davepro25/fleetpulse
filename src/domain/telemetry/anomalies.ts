import type { SensorFault, SensorValue } from './detectors';
import type { FleetLive } from './pipeline';
import { PROFILES } from './profiles';

const SENSORS = ['speed', 'fuel'] as const;
const MAX_ANOMALIES = 200;

/**
 * One sensor fault from first bad reading to recovery. `sensor_glitch`: the readings came back
 * on their own (the sensor was wrong). `confirmed`: a fuel drop that held past the confirm
 * window (the truck really lost fuel).
 */
export interface SensorAnomaly {
  id: string;
  truckId: string;
  sensor: (typeof SENSORS)[number];
  kind: SensorFault['kind'];
  since: number;
  until: number | null;
  raw: number;
  lastGood: number | null;
  outcome: 'ongoing' | 'sensor_glitch' | 'confirmed';
}

/**
 * Compares a truck before and after one telemetry message: a fault that appears opens an
 * entry, a fault that clears closes it. The detectors stay unaware of the log.
 * Newest first; returns the same array when nothing started or ended.
 */
export function trackAnomalies(
  log: SensorAnomaly[],
  prev: FleetLive,
  next: FleetLive,
): SensorAnomaly[] {
  let result = log;
  for (const truck of Object.values(next)) {
    const before = prev[truck.id];
    if (truck === before) continue;
    for (const sensor of SENSORS) {
      const was = before?.[sensor] ?? null;
      const now = truck[sensor];
      if (!was?.fault && now.fault) {
        result = [opened(truck.id, sensor, now.fault, now.value), ...result].slice(
          0,
          MAX_ANOMALIES,
        );
      } else if (was?.fault && !now.fault) {
        const id = anomalyId(truck.id, sensor, was.fault.since);
        const closed = { until: truck.lastReadingAt, outcome: outcomeOf(was, now) };
        result = result.map((a) => (a.id === id ? { ...a, ...closed } : a));
      }
    }
  }
  return result;
}

function opened(
  truckId: string,
  sensor: SensorAnomaly['sensor'],
  fault: SensorFault,
  lastGood: number | null,
): SensorAnomaly {
  return {
    id: anomalyId(truckId, sensor, fault.since),
    truckId,
    sensor,
    kind: fault.kind,
    since: fault.since,
    until: null,
    raw: fault.raw,
    lastGood,
    outcome: 'ongoing',
  };
}

// A suspected fuel drop ends one of two ways: the reading came back near the trusted value (a
// glitch), or the low value outlasted the confirm window (real). An impossible speed only ends
// by becoming plausible again.
function outcomeOf(was: SensorValue, now: SensorValue): SensorAnomaly['outcome'] {
  const dropHeld =
    was.fault?.kind === 'sudden_drop' &&
    was.value !== null &&
    now.value !== null &&
    now.value <= was.value - PROFILES.truck.fuelDropSuspectPct;
  return dropHeld ? 'confirmed' : 'sensor_glitch';
}

const anomalyId = (truckId: string, sensor: string, since: number) =>
  `${truckId}/${sensor}/${since}`;
