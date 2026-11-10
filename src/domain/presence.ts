import type { WsInbound } from '../contracts';
import { displayName } from '../utils/identity';

export interface Peer {
  id: string;
  name: string;
  viewingTruckId: string | null;
  joinedAt: number | null;
}

export type Roster = Readonly<Record<string, Peer>>;

export type PresenceMessage = Extract<
  WsInbound,
  { type: 'dispatcher_joined' | 'dispatcher_left' | 'dispatcher_viewing' }
>;

/** The server delays 20% of leaves by 10 s (quirk 6); 2 s of margin for network and timers. */
export const GHOST_GRACE_MS = 12_000;

export function applyPresence(
  roster: Roster,
  message: PresenceMessage,
  now: number,
  selfId: string,
): Roster {
  const id = message.dispatcherId;
  // Our own leave arrives after we reconnect (the old socket's close); we are never in the list.
  if (id === selfId) return roster;
  const peer = roster[id];

  switch (message.type) {
    case 'dispatcher_joined':
      return {
        ...roster,
        [id]: {
          id,
          name: message.name,
          viewingTruckId: peer?.viewingTruckId ?? null,
          joinedAt: now,
        },
      };

    case 'dispatcher_viewing':
      return {
        ...roster,
        [id]: {
          id,
          name: peer?.name ?? displayName(id),
          viewingTruckId: message.truckId,
          joinedAt: peer?.joinedAt ?? null,
        },
      };

    case 'dispatcher_left': {
      if (!peer) return roster;
      // A leave this soon after a join belongs to the connection before it (a ghost).
      if (peer.joinedAt !== null && now - peer.joinedAt < GHOST_GRACE_MS) return roster;
      const { [id]: _gone, ...rest } = roster;
      return rest;
    }
  }
}
