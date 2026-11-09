import type { SensorValue } from '../domain/telemetry/detectors';

export interface SensorText {
  text: string;
  warning: string | null;
}

const WARNING = {
  out_of_range: 'Sensor fault',
  sudden_drop: 'Possible sensor glitch',
} as const;

// The raw faulty value (e.g. 999) is never shown: the dispatcher sees the last valid one.
export function formatSensor(sensor: SensorValue, unit: string): SensorText {
  const text = sensor.value === null ? '—' : `${Math.round(sensor.value)} ${unit}`;
  if (!sensor.fault) return { text, warning: null };

  const since = new Date(sensor.fault.since).toLocaleTimeString();
  return {
    text,
    warning: `${WARNING[sensor.fault.kind]} since ${since}, showing last valid value`,
  };
}
