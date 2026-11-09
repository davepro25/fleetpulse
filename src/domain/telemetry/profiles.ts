export interface VehicleProfile {
  minSpeedKmh: number;
  maxSpeedKmh: number;
  /** A drop larger than this between two readings is suspected to be a sensor glitch. */
  fuelDropSuspectPct: number;
  /** A suspected drop that lasts this long is accepted as real. */
  fuelDropConfirmMs: number;
  lowFuelPct: number;
}

// Limits per vehicle type. The API has no vehicle-type field, so every vehicle is a truck.
// A new type is a new entry here; the detectors take a profile and never change.
export const PROFILES = {
  truck: {
    minSpeedKmh: 0,
    maxSpeedKmh: 130, // live speed is capped at 80, but batch (±5) and history (±10) jitter above it
    fuelDropSuspectPct: 5, // real consumption is ~0.02 % per reading
    fuelDropConfirmMs: 10_000, // the server's glitch lasts at most 4 s
    lowFuelPct: 15,
  },
} satisfies Record<string, VehicleProfile>;
