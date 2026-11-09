import type { TruckStatus } from '../../contracts';

export const STATUS_COLOR: Record<TruckStatus, string> = {
  active: '#1D9E75',
  idle: '#378ADD',
  maintenance: '#888780',
};
