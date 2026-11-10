import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { TruckAlert } from '../contracts';

const MAX_ALERTS = 50;

interface AlertState {
  alerts: TruckAlert[];
  add(alert: TruckAlert): void;
  clear(): void;
}

// Our own alert arrives twice (POST response and WS echo); the id makes the second a no-op.
export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  add: (alert) =>
    set((state) =>
      state.alerts.some((a) => a.id === alert.id)
        ? state
        : { alerts: [alert, ...state.alerts].slice(0, MAX_ALERTS) },
    ),
  clear: () => set({ alerts: [] }),
}));

export const useTruckAlerts = (truckId: string): TruckAlert[] =>
  useAlertStore(useShallow((state) => state.alerts.filter((a) => a.truckId === truckId)));
