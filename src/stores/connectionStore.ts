import { create } from 'zustand';
import type { StreamStatus } from '../api/sse';

interface ConnectionState {
  sse: StreamStatus;
  ws: StreamStatus;
  wsRttMs: number | null;
}

export const useConnectionStore = create<ConnectionState>(() => ({
  sse: 'connecting',
  ws: 'connecting',
  wsRttMs: null,
}));
