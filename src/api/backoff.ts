const BASE_MS = 1_000;
const MAX_MS = 30_000;

/** 1 s, 2 s, 4 s ... up to 30 s. Jitter keeps many tabs from reconnecting at the same instant. */
export function backoffMs(attempt: number): number {
  const ceiling = Math.min(MAX_MS, BASE_MS * 2 ** attempt);
  return ceiling * (0.5 + Math.random() * 0.5);
}
