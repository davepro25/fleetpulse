import { SseMessageSchema, type SseMessage } from '../contracts';
import { backoffMs } from './backoff';
import { API } from './endpoints';

export type StreamStatus = 'connecting' | 'open' | 'reconnecting';

export interface TelemetryStreamHandlers {
  onMessage(message: SseMessage): void;
  onStatus(status: StreamStatus): void;
  /** Opened after any failure. The server has no replay, so callers must refetch state. */
  onReconnected(): void;
}

export function openTelemetryStream(
  handlers: TelemetryStreamHandlers,
  url: string = API.telemetryStream,
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
      // Bad JSON and a wrong shape are the same case: drop the frame, keep the stream.
      let message: SseMessage;
      try {
        message = SseMessageSchema.parse(JSON.parse(event.data));
      } catch {
        console.warn('Dropped invalid SSE frame', event.data);
        return;
      }
      // Outside the try, so a bug in a handler is not reported as a bad frame.
      handlers.onMessage(message);
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
