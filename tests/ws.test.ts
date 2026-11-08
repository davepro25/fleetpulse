import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDispatcherSocket } from '../src/api/ws';
import ws from './fixtures/ws.json';

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];

  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor() {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
}

const IDENTITY = { id: 'Eli~bbbb2222', name: 'Eli' };
const REGISTER = { type: 'register_dispatcher', dispatcherId: IDENTITY.id, name: IDENTITY.name };
const latest = () => FakeWebSocket.instances.at(-1)!;
const handlers = () => ({
  onMessage: vi.fn(),
  onStatus: vi.fn(),
  onRtt: vi.fn(),
  onReconnected: vi.fn(),
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeWebSocket);
  FakeWebSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('openDispatcherSocket', () => {
  it('after a drop: reconnects, re-registers the same id and re-announces the viewed truck', async () => {
    const h = handlers();
    const socket = openDispatcherSocket(IDENTITY, h, 'ws://test/ws');
    latest().open();
    socket.sendViewing('truck_3');

    latest().close();
    await vi.advanceTimersByTimeAsync(1_000);
    latest().open();

    expect(latest().sent).toEqual([REGISTER, { type: 'viewing_truck', truckId: 'truck_3' }]);
    expect(h.onReconnected).toHaveBeenCalledTimes(1);
  });

  it('reports RTT from a pong, and treats a missing pong as a dead socket', async () => {
    const h = handlers();
    openDispatcherSocket(IDENTITY, h, 'ws://test/ws');
    latest().open();

    await vi.advanceTimersByTimeAsync(15_000 + 40);
    latest().onmessage?.({ data: JSON.stringify(ws.pong) });
    expect(h.onRtt).toHaveBeenCalledWith(40);

    await vi.advanceTimersByTimeAsync(15_000 + 10_000 + 1_000); // next ping, no pong
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('close() stops pings and never reconnects', async () => {
    const socket = openDispatcherSocket(IDENTITY, handlers(), 'ws://test/ws');
    latest().open();

    socket.close();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(vi.getTimerCount()).toBe(0);
    expect(latest().sent).toEqual([REGISTER]);
  });
});
