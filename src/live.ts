import type { QueryClient } from '@tanstack/react-query';
import { openTelemetryStream } from './api/sse';
import { openDispatcherSocket, type DispatcherSocket } from './api/ws';
import type { SseMessage, WsInbound } from './contracts';
import { QUERY_KEYS } from './queries/keys';
import { applyRouteChange } from './queries/routes';
import { useConnectionStore } from './stores/connectionStore';
import { useTelemetryStore } from './stores/telemetryStore';
import type { Identity } from './utils/identity';

// Composition root: the one place that routes every server message into stores and caches.

export interface Live {
  socket: DispatcherSocket;
  stop(): void;
}

export function startLive(queryClient: QueryClient, identity: Identity): Live {
  const closeStream = openTelemetryStream({
    onMessage: handleTelemetry,
    onStatus: (sse) => useConnectionStore.setState({ sse }),
    // SSE has no replay: after a gap, reload everything from REST.
    onReconnected: () => void queryClient.invalidateQueries(),
  });

  const socket = openDispatcherSocket(identity, {
    onMessage: (message) => handleDispatch(queryClient, message),
    onStatus: (ws) => useConnectionStore.setState({ ws }),
    onRtt: (wsRttMs) => useConnectionStore.setState({ wsRttMs }),
    // Route events sent while we were offline are lost.
    onReconnected: () => void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.routes }),
  });

  return {
    socket,
    stop: () => {
      closeStream();
      socket.close();
    },
  };
}

function handleTelemetry(message: SseMessage) {
  if (message.type === 'telemetry' || message.type === 'gps_batch') {
    useTelemetryStore.getState().ingest(message, Date.now());
  }
}

function handleDispatch(queryClient: QueryClient, message: WsInbound) {
  switch (message.type) {
    // Also the echo of our own changes: applyRouteChange makes the second copy a no-op.
    case 'route_assigned':
    case 'route_updated':
    case 'route_reassigned':
      applyRouteChange(queryClient, message.route);
      break;
    // Stages 6-7: presence, alerts, fleet_reset.
  }
}
