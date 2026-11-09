import { z } from 'zod';
import { parseJson } from './json';

// dispatcher_viewing carries only an id, so the readable name is encoded into it: "Dana~3f9a1c2e".

const IdentitySchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Identity = z.infer<typeof IdentitySchema>;

const STORAGE_KEY = 'fleetpulse.identity';
const NAME_PATTERN = /^[A-Za-z0-9 ._-]{2,24}$/; // no "~", no markup

export type NameResult = { ok: true; name: string } | { ok: false; error: string };

export function validateName(raw: string): NameResult {
  const name = raw.trim();
  if (NAME_PATTERN.test(name)) return { ok: true, name };
  return { ok: false, error: '2-24 characters: letters, digits, space, dot, dash or underscore' };
}

export function createIdentity(name: string): Identity {
  const identity = { id: `${name}~${crypto.randomUUID().slice(0, 8)}`, name };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  return identity;
}

export function clearIdentity(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function loadIdentity(): Identity | null {
  const saved = IdentitySchema.safeParse(parseJson(sessionStorage.getItem(STORAGE_KEY) ?? ''));
  return saved.success ? saved.data : null;
}

export function displayName(dispatcherId: string): string {
  const at = dispatcherId.lastIndexOf('~');
  return at > 0 ? dispatcherId.slice(0, at) : dispatcherId;
}
