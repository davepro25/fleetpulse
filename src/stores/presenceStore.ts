import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { applyPresence, type PresenceMessage, type Roster } from '../domain/presence';

interface PresenceState {
  /** Other dispatchers; never ourselves. */
  roster: Roster;
  apply(message: PresenceMessage, now: number, selfId: string): void;
  clear(): void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  roster: {},
  apply: (message, now, selfId) =>
    set((state) => ({ roster: applyPresence(state.roster, message, now, selfId) })),
  clear: () => set({ roster: {} }),
}));

/** Names of the other dispatchers looking at this truck. */
export const useViewersOf = (truckId: string): string[] =>
  usePresenceStore(
    useShallow((state) =>
      Object.values(state.roster)
        .filter((peer) => peer.viewingTruckId === truckId)
        .map((peer) => peer.name),
    ),
  );
