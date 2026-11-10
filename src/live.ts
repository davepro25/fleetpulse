import type { QueryClient } from '@tanstack/react-query';
import { openTelemetryStream } from './api/sse';
import { openDispatcherSocket, type DispatcherSocket } from './api/ws';
import type { SseMessage, WsInbound } from './contracts';
import { QUERY_KEYS } from './queries/keys';
import { applyRouteChange } from './queries/routes';
import { useAlertStore } from './stores/alertStore';
import { useAuditStore } from './stores/auditStore';
import { useConnectionStore } from './stores/connectionStore';
import { usePresenceStore } from './stores/presenceStore';
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
    onMessage: (message) => handleDispatch(message, queryClient, socket, identity.id),
    onStatus: (ws) => useConnectionStore.setState({ ws }),
    onRtt: (wsRttMs) => useConnectionStore.setState({ wsRttMs }),
    onReconnected: () => {
      // Route events and leaves sent while we were offline are lost. Peers answer our new
      // join, so the roster refills by itself.
      usePresenceStore.getState().clear();
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.routes });
    },
  });

  return {
    socket,
    stop: () => {
      closeStream();
      socket.close();
      usePresenceStore.getState().clear();
    },
  };
}

function handleTelemetry(message: SseMessage) {
  if (message.type === 'telemetry' || message.type === 'gps_batch') {
    useTelemetryStore.getState().ingest(message, Date.now());
  }
}

function handleDispatch(
  message: WsInbound,
  queryClient: QueryClient,
  socket: DispatcherSocket,
  selfId: string,
) {
  switch (message.type) {
    // Also the echo of our own changes: applyRouteChange makes the second copy a no-op.
    case 'route_assigned':
    case 'route_updated':
    case 'route_reassigned':
      applyRouteChange(queryClient, message.route);
      break;

    case 'dispatcher_joined':
      // The server never sends a newcomer the list of who is online, so everyone answers.
      socket.announceViewing();
      usePresenceStore.getState().apply(message, Date.now(), selfId);
      break;
    case 'dispatcher_left':
    case 'dispatcher_viewing':
      usePresenceStore.getState().apply(message, Date.now(), selfId);
      break;

    case 'truck_alert':
      useAlertStore.getState().add(message.alert);
      break;

    case 'fleet_reset':
      handleFleetReset(queryClient, socket);
      break;
  }
}

/**
 * The server wipes routes (ids restart at route_1, version 1), moves every truck and forgets
 * every dispatcher, while sockets stay open. Old data would hide the new, so drop it all.
 */
export function handleFleetReset(
  queryClient: QueryClient,
  socket: Pick<DispatcherSocket, 'reregister'>,
) {
  queryClient.setQueryData(QUERY_KEYS.routes, []);
  useAuditStore.getState().clear();
  useAlertStore.getState().clear();
  usePresenceStore.getState().clear();
  useTelemetryStore.getState().reset();
  void queryClient.invalidateQueries();
  socket.reregister();
}
