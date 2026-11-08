import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTelemetryStream } from '../src/api/sse';

class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readyState = FakeEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    FakeEventSource.instances.push(this);
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }

  fail(readyState: number) {
    this.readyState = readyState;
    this.onerror?.();
  }
}

const latest = () => FakeEventSource.instances.at(-1)!;
const handlers = () => ({ onMessage: vi.fn(), onStatus: vi.fn(), onReconnected: vi.fn() });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('EventSource', FakeEventSource);
  FakeEventSource.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('openTelemetryStream', () => {
  it('reconnects itself only when the browser gives up (CLOSED)', async () => {
    openTelemetryStream(handlers());

    latest().fail(FakeEventSource.CONNECTING); // the browser retries by itself
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);

    latest().fail(FakeEventSource.CLOSED); // e.g. proxy 502 at startup
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it('asks for a refetch on the first open after a failure, not on a clean first open', async () => {
    const clean = handlers();
    openTelemetryStream(clean);
    latest().onopen?.();
    expect(clean.onReconnected).not.toHaveBeenCalled();

    const recovering = handlers();
    openTelemetryStream(recovering);
    latest().fail(FakeEventSource.CLOSED); // server.js not up yet
    await vi.advanceTimersByTimeAsync(1_000);
    latest().onopen?.();
    expect(recovering.onReconnected).toHaveBeenCalledTimes(1);
  });

  it('close() cancels a pending reconnect', async () => {
    const stop = openTelemetryStream(handlers());
    latest().fail(FakeEventSource.CLOSED);

    stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(vi.getTimerCount()).toBe(0);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
