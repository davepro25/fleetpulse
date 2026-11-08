import { createContext, useContext } from 'react';
import type { Identity } from '../utils/identity';
import type { DispatcherSocket } from '../api/ws';

// Dependency injection only. High-frequency data lives in Zustand stores, never in context.
export interface AppServices {
  identity: Identity;
  socket: DispatcherSocket;
}

const AppContext = createContext<AppServices | null>(null);

export const AppProvider = AppContext.Provider;

export function useApp(): AppServices {
  const services = useContext(AppContext);
  if (!services) throw new Error('useApp() must be used inside <AppProvider>');
  return services;
}
