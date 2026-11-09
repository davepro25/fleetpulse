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
  if (raw >= profile.minSpeedKmh && raw <= profile.maxSpeedKmh) return { value: raw, fault: null };
  const since = prev.fault?.since ?? timestamp;
  return { value: prev.value, fault: { kind: 'out_of_range', since, raw } };
}

/**
 * A sudden drop is held back as a suspected glitch. It is accepted as real if it lasts
 * fuelDropConfirmMs; it is discarded if the reading recovers first. Small drops and rises
 * (consumption, refuelling) are always accepted.
 */
export function checkFuel(
  prev: SensorValue,
  raw: number,
  timestamp: number,
  profile: VehicleProfile,
): SensorValue {
  const trusted = prev.value;
  if (trusted === null || raw >= trusted - profile.fuelDropSuspectPct) {
    return { value: raw, fault: null };
  }
  const since = prev.fault?.since ?? timestamp;
  if (timestamp - since >= profile.fuelDropConfirmMs) return { value: raw, fault: null };
  return { value: trusted, fault: { kind: 'sudden_drop', since, raw } };
}

export function isLowFuel(fuel: SensorValue, profile: VehicleProfile): boolean {
  return fuel.fault === null && fuel.value !== null && fuel.value < profile.lowFuelPct;
}
