import type { QueryClient } from '@tanstack/react-query';
import { useConnectionStore } from './stores/connectionStore';
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
    onMessage: () => {}, // Stage 3: telemetry pipeline
    onStatus: (sse) => useConnectionStore.setState({ sse }),
    onReconnected: () => refetch('fleet', 'routes'),
  });

  const socket = openDispatcherSocket(identity, {
    onMessage: () => {}, // Stages 5-7: routes, presence, alerts, fleet_reset
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
