export interface VehicleProfile {
  minSpeedKmh: number;
  maxSpeedKmh: number;
  /** A drop larger than this between two readings is suspected to be a sensor glitch. */
  fuelDropSuspectPct: number;
  /** A suspected drop that lasts this long is accepted as real. */
  fuelDropConfirmMs: number;
  lowFuelPct: number;
}

export const PROFILES = {
  truck: {
    minSpeedKmh: 0,
    maxSpeedKmh: 130, // live speed is capped at 80, but batch (±5) and history (±10) jitter above it
    fuelDropSuspectPct: 5, // real consumption is ~0.02 % per reading
    fuelDropConfirmMs: 10_000, // the server's glitch lasts at most 4 s
    lowFuelPct: 15,
  },
} satisfies Record<string, VehicleProfile>;

// The API has no vehicle type, so every vehicle is a truck. A new type is a new PROFILES entry
// plus a mapping here; the detectors don't change.
export function profileFor(_truckId: string): VehicleProfile {
  return PROFILES.truck;
}
