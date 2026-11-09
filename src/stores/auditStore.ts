import { create } from 'zustand';
import type { RouteStatus } from '../contracts';
import type { Actor } from '../domain/routes/conflicts';

const MAX_ENTRIES = 200;

export interface AuditEntry {
  /** routeId@version: the server bumps the version on every change, so this is unique. */
  key: string;
  routeId: string;
  kind: Actor['action'];
  actor: string;
  at: number;
  truckId: string;
  status: RouteStatus;
  previous?: { truckId: string; status: RouteStatus };
}

interface AuditState {
  /** Newest first. Only changes seen since this tab connected: the server has no history. */
  entries: AuditEntry[];
  record(entry: AuditEntry): void;
  clear(): void;
}

export const useAuditStore = create<AuditState>((set) => ({
  entries: [],
  record: (entry) =>
    set((state) =>
      state.entries.some((e) => e.key === entry.key)
        ? state
        : { entries: [entry, ...state.entries].slice(0, MAX_ENTRIES) },
    ),
  clear: () => set({ entries: [] }),
}));
