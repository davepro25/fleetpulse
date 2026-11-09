import type { VehicleProfile } from './profiles';

export interface SensorFault {
  kind: 'out_of_range' | 'sudden_drop';
  since: number;
  raw: number;
}

/** `value` is the last plausible reading; it stays on screen while a fault is active. */
export interface SensorValue {
  value: number | null;
  fault: SensorFault | null;
}

export const NO_VALUE: SensorValue = { value: null, fault: null };

export function checkSpeed(
  prev: SensorValue,
  raw: number,
  timestamp: number,
  profile: VehicleProfile,
): SensorValue {
  // A speed the vehicle can actually drive: show it.
  if (raw >= profile.minSpeedKmh && raw <= profile.maxSpeedKmh) return { value: raw, fault: null };

  // Impossible value (truck_7's stuck 999, a negative batch speed): keep the last good value
  // and flag a fault. `since` stays at the first bad reading while it keeps repeating.
  const since = prev.fault?.since ?? timestamp;
  return { value: prev.value, fault: { kind: 'out_of_range', since, raw } };
}

export function checkFuel(
  prev: SensorValue,
  raw: number,
  timestamp: number,
  profile: VehicleProfile,
): SensorValue {
  const trusted = prev.value;

  // First reading, normal consumption, a refuel, or a glitch that recovered: accept it.
  if (trusted === null || raw >= trusted - profile.fuelDropSuspectPct) {
    return { value: raw, fault: null };
  }

  // Sudden drop that has lasted long enough to be real (a leak, an empty tank): accept it.
  const since = prev.fault?.since ?? timestamp;
  if (timestamp - since >= profile.fuelDropConfirmMs) return { value: raw, fault: null };

  // Sudden drop not yet confirmed (the 0 % glitch lasts 2-4 s): keep showing the last
  // trusted value and mark it as a suspected glitch.
  return { value: trusted, fault: { kind: 'sudden_drop', since, raw } };
}

// A suspected glitch never counts as low fuel (the spec: "don't trigger false low-fuel alerts").
export function isLowFuel(fuel: SensorValue, profile: VehicleProfile): boolean {
  return fuel.fault === null && fuel.value !== null && fuel.value < profile.lowFuelPct;
}
