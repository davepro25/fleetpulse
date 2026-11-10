import type { RouteStatus, TruckStatus } from '../../contracts';
import type { Tone } from '../ui';

export const STATUS_COLOR: Record<TruckStatus, string> = {
  active: '#10b981',
  idle: '#0ea5e9',
  maintenance: '#94a3b8',
};

export const TRUCK_STATUS_TONE: Record<TruckStatus, Tone> = {
  active: 'green',
  idle: 'blue',
  maintenance: 'neutral',
};

export const ROUTE_STATUS_TONE: Record<RouteStatus, Tone> = {
  assigned: 'indigo',
  'in-progress': 'blue',
  completed: 'green',
  cancelled: 'neutral',
};

export const MARKER_RING = {
  lowFuel: '#dc2626',
  sensorFault: '#d97706',
  none: '#1e293b',
};
