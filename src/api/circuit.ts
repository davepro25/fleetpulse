import type { Hooks } from 'ky';

export const TRIP_AFTER = 3;
export const PROBE_AFTER_MS = 15_000;

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit open: the server answered 503 repeatedly');
    this.name = 'CircuitOpenError';
  }
}

interface CircuitState {
  failures: number;
  openedAt: number | null;
}

const CLOSED: CircuitState = { failures: 0, openedAt: null };

// Only a 503 counts: a 502 from the proxy means server.js is down, which SSE reconnects handle.
// Every 503 from TRIP_AFTER on (re)opens the circuit, so a failed probe waits another window.
function record(state: CircuitState, status: number, now: number): CircuitState {
  if (status !== 503) return status < 300 ? CLOSED : state;
  const failures = state.failures + 1;
  return { failures, openedAt: failures >= TRIP_AFTER ? now : null };
}

/**
 * ky hooks that give one endpoint its own circuit breaker. ky runs `afterResponse` on every
 * attempt, so the count includes its retries. Throwing there ends the request at once, instead
 * of waiting Retry-After for a retry the open circuit would refuse anyway.
 */
export function circuitBreakerHooks(): Hooks {
  let state = CLOSED;
  const isOpen = () => state.openedAt !== null && Date.now() - state.openedAt < PROBE_AFTER_MS;
  return {
    beforeRequest: [
      () => {
        if (isOpen()) throw new CircuitOpenError();
      },
    ],
    afterResponse: [
      ({ response }) => {
        state = record(state, response.status, Date.now());
        if (isOpen()) throw new CircuitOpenError();
      },
    ],
  };
}
