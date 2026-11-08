import { beforeEach, describe, expect, it } from 'vitest';
import { createIdentity, loadIdentity, validateName } from '../src/utils/identity';

beforeEach(() => sessionStorage.clear());

describe('identity', () => {
  it('encodes the name into the id, survives a reload and ignores corrupted storage', () => {
    const created = createIdentity('Dana');

    expect(created.id).toMatch(/^Dana~[0-9a-f]{8}$/);
    expect(loadIdentity()).toEqual(created);

    sessionStorage.setItem('fleetpulse.identity', '{broken');
    expect(loadIdentity()).toBeNull();
  });

  it('trims names and rejects markup, the separator, too short and too long', () => {
    expect(validateName('  Dana ')).toEqual({ ok: true, name: 'Dana' });
    for (const bad of ['<b>x</b>', 'Da~na', 'a', 'x'.repeat(25)]) {
      expect(validateName(bad).ok).toBe(false);
    }
  });
});
