import { WsInboundSchema, type WsInbound, type WsOutbound } from '../contracts';
import { backoffMs } from './backoff';
import { API } from './endpoints';
import type { Identity } from '../utils/identity';
import type { StreamStatus } from './sse';

const PING_INTERVAL_MS = 15_000;
const PONG_TIMEOUT_MS = 10_000;

export interface DispatcherSocketHandlers {
  onMessage(message: WsInbound): void;
  onStatus(status: StreamStatus): void;
  onRtt(ms: number): void;
  onReconnected(): void;
}

export interface DispatcherSocket {
  sendViewing(truckId: string | null): void;
  announceViewing(): void;
  reregister(): void;
  close(): void;
}

export function defaultWsUrl(): string {
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${API.socket}`;
}

export function openDispatcherSocket(
  identity: Identity,
  handlers: DispatcherSocketHandlers,
  url = defaultWsUrl(),
): DispatcherSocket {
  let ws: WebSocket | null = null;
  let viewing: string | null = null;
  let attempt = 0;
  let hadFailure = false;
  let closedByUser = false;
  let pingSentAt = 0;
  let pingTimer: ReturnType<typeof setInterval> | undefined;
  let pongTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const send = (message: WsOutbound): void => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  };

  const register = (): void =>
    send({ type: 'register_dispatcher', dispatcherId: identity.id, name: identity.name });

  const stopTimers = (): void => {
    clearInterval(pingTimer);
    clearTimeout(pongTimer);
    clearTimeout(reconnectTimer);
  };

  const scheduleReconnect = (): void => {
    stopTimers();
    if (closedByUser) return;
    hadFailure = true;
    handlers.onStatus('reconnecting');
    reconnectTimer = setTimeout(connect, backoffMs(attempt++));
  };

  const ping = (): void => {
    pingSentAt = Date.now();
    send({ type: 'ping' });
    // No pong means a half-open socket, which onclose would not report for a long time.
    pongTimer = setTimeout(() => {
      if (ws) ws.onclose = null;
      ws?.close();
      scheduleReconnect();
    }, PONG_TIMEOUT_MS);
  };

  function connect(): void {
    handlers.onStatus(hadFailure ? 'reconnecting' : 'connecting');
    const socket = new WebSocket(url);
    ws = socket;

    socket.onopen = () => {
      attempt = 0;
      register();
      if (viewing !== null) send({ type: 'viewing_truck', truckId: viewing });
      pingTimer = setInterval(ping, PING_INTERVAL_MS);
      handlers.onStatus('open');
      if (hadFailure) handlers.onReconnected();
      hadFailure = false;
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      let message: WsInbound;
      try {
        message = WsInboundSchema.parse(JSON.parse(event.data));
      } catch {
        console.warn('Dropped invalid WS message', event.data);
        return;
      }
      if (message.type === 'pong') {
        clearTimeout(pongTimer);
        handlers.onRtt(Date.now() - pingSentAt);
        return;
      }
      handlers.onMessage(message);
    };

    socket.onclose = scheduleReconnect;
  }

  connect();

  return {
    sendViewing(truckId) {
      viewing = truckId;
      send({ type: 'viewing_truck', truckId });
    },
    announceViewing: () => send({ type: 'viewing_truck', truckId: viewing }),
    reregister: register,
    close() {
      closedByUser = true;
      stopTimers();
      if (ws) ws.onclose = null;
      ws?.close();
    },
  };
}
