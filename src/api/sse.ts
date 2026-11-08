import { SseMessageSchema, type SseMessage } from '../contracts';
import { backoffMs } from './backoff';
import { parseJson } from '../utils/json';

export type StreamStatus = 'connecting' | 'open' | 'reconnecting';

export interface TelemetryStreamHandlers {
  onMessage(message: SseMessage): void;
  onStatus(status: StreamStatus): void;
  /** Opened after any failure. The server has no replay, so callers must refetch state. */
  onReconnected(): void;
}

export function openTelemetryStream(
  handlers: TelemetryStreamHandlers,
  url = '/api/telemetry/stream',
): () => void {
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let hadFailure = false;

  const connect = (): void => {
    handlers.onStatus(hadFailure ? 'reconnecting' : 'connecting');
    const es = new EventSource(url);
    source = es;

    es.onopen = () => {
      attempt = 0;
      handlers.onStatus('open');
      if (hadFailure) handlers.onReconnected();
      hadFailure = false;
    };

    es.onmessage = (event: MessageEvent<string>) => {
      const parsed = SseMessageSchema.safeParse(parseJson(event.data));
      if (parsed.success) handlers.onMessage(parsed.data);
      else console.warn('Dropped invalid SSE frame', event.data);
    };

    es.onerror = () => {
      hadFailure = true;
      handlers.onStatus('reconnecting');
      // CONNECTING means the browser retries by itself. CLOSED means it gave up
      // (e.g. the proxy answered 502 while server.js was starting), so the retry is ours.
      if (es.readyState === EventSource.CLOSED) {
        es.close();
        reconnectTimer = setTimeout(connect, backoffMs(attempt++));
      }
    };
  };

  connect();

  return () => {
    clearTimeout(reconnectTimer);
    source?.close();
  };
}
