import { describe, expect, it } from 'vitest';
import { isStale } from '../src/stores/telemetryStore';
import { formatSensor } from '../src/utils/format';

describe('display', () => {
  it('shows the last valid value with a warning for a faulted sensor, never the raw value', () => {
    const stuck = formatSensor(
      { value: 0, fault: { kind: 'out_of_range', since: 0, raw: 999 } },
      'km/h',
    );
    expect(stuck.text).toBe('0 km/h');
    expect(stuck.warning).toMatch(/sensor fault/i);
    expect(JSON.stringify(stuck)).not.toContain('999');

    const glitch = formatSensor(
      { value: 52.4, fault: { kind: 'sudden_drop', since: 0, raw: 0 } },
      '%',
    );
    expect(glitch.text).toBe('52 %');
    expect(glitch.warning).toMatch(/glitch/i);

    expect(formatSensor({ value: null, fault: null }, '%')).toEqual({ text: '—', warning: null });
  });

  it('marks telemetry stale only after more than 10 s without a reading', () => {
    expect(isStale(null, 50_000)).toBe(false); // nothing received yet: "connecting", not stale
    expect(isStale(40_000, 50_000)).toBe(false);
    expect(isStale(40_000, 50_001)).toBe(true);
  });
});
