// Every server address the app uses. Same origin: the Vite proxy forwards /api and /ws to :3000.
export const API = {
  fleet: '/api/fleet',
  routes: '/api/routes',
  route: (routeId: string) => `/api/routes/${encodeURIComponent(routeId)}`,
  reassign: (routeId: string) => `/api/routes/${encodeURIComponent(routeId)}/reassign`,
  telemetryStream: '/api/telemetry/stream',
  socket: '/ws',
} as const;

export const HEADER = {
  /** Required on every mutation; the server trusts it as the dispatcher's identity. */
  dispatcher: 'X-Dispatcher-Id',
  /** Route _version as a bare integer: the server parseInt()s it. */
  ifMatch: 'If-Match',
} as const;
