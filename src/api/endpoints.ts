// Same origin: the Vite proxy forwards /api and /ws to :3000.
export const API = {
  fleet: '/api/fleet',
  truck: (truckId: string) => `/api/fleet/${encodeURIComponent(truckId)}`,
  alert: (truckId: string) => `/api/fleet/${encodeURIComponent(truckId)}/alert`,
  history: (truckId: string) => `/api/telemetry/history/${encodeURIComponent(truckId)}`,
  routes: '/api/routes',
  route: (routeId: string) => `/api/routes/${encodeURIComponent(routeId)}`,
  reassign: (routeId: string) => `/api/routes/${encodeURIComponent(routeId)}/reassign`,
  telemetryStream: '/api/telemetry/stream',
  socket: '/ws',
} as const;

export const HEADER = {
  dispatcher: 'X-Dispatcher-Id',
  /** Route _version as a bare integer: the server parseInt()s it. */
  ifMatch: 'If-Match',
} as const;
