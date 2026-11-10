import { createContext, useContext } from 'react';
import type { Identity } from '../utils/identity';
import type { DispatcherSocket } from '../api/ws';

export interface Session {
  identity: Identity;
  socket: DispatcherSocket;
}

const SessionContext = createContext<Session | null>(null);

export const SessionProvider = SessionContext.Provider;

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession() must be used inside <SessionProvider>');
  return session;
}
