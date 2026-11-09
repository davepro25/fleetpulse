import type { QueryClient } from '@tanstack/react-query';
import { applyRouteChange } from './queries/routes';
import { useConnectionStore } from './stores/connectionStore';
import { useTelemetryStore } from './stores/telemetryStore';
import type { Identity } from './utils/identity';
import { openTelemetryStream } from './api/sse';
import { openDispatcherSocket, type DispatcherSocket } from './api/ws';

// Composition root: the one place that routes every server message into stores and caches.

export interface Live {
  socket: DispatcherSocket;
  stop(): void;
}

interface LiveDeps {
  queryClient: QueryClient;
  identity: Identity;
}

export function startLive({ queryClient, identity }: LiveDeps): Live {
  const refetch = (...keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  const closeStream = openTelemetryStream({
    onMessage: (message) => {
      if (message.type === 'telemetry' || message.type === 'gps_batch') {
        useTelemetryStore.getState().ingest(message, Date.now());
      }
    },
    onStatus: (sse) => useConnectionStore.setState({ sse }),
    onReconnected: () => refetch('fleet', 'routes'),
  });

  const socket = openDispatcherSocket(identity, {
    onMessage: (message) => {
      switch (message.type) {
        // Also the echo of our own changes: applyRouteChange makes the second copy a no-op.
        case 'route_assigned':
        case 'route_updated':
        case 'route_reassigned':
          applyRouteChange(queryClient, message.route);
          break;
        // Stages 6-7: presence, alerts, fleet_reset.
      }
    },
    onStatus: (ws) => useConnectionStore.setState({ ws }),
    onRtt: (wsRttMs) => useConnectionStore.setState({ wsRttMs }),
    onReconnected: () => refetch('routes'),
  });

  return {
    socket,
    stop: () => {
      closeStream();
      socket.close();
    },
  };
}
