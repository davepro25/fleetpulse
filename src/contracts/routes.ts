// Routes: REST /api/routes*, their 409 bodies, and the route_* events.

export type RouteStatus = 'assigned' | 'in-progress' | 'completed' | 'cancelled';

export interface Route {
  id: string;
  truckId: string;
  destination: string;
  priority: string;
  notes: string;
  status: RouteStatus;
  assignedBy: string;
  assignedAt: number;
  lastModifiedBy?: string;
  lastModifiedAt?: number;
  reassignedBy?: string;
  reassignedAt?: number;
  /** Optimistic-lock version; send as a bare integer in If-Match (server uses parseInt). */
  _version: number;
}

export interface RoutesResponse { routes: Route[]; timestamp: number }

export interface CreateRouteRequest { truckId: string; destination: string; priority?: string; notes?: string }
export interface UpdateRouteRequest { status?: RouteStatus; notes?: string; priority?: string }
export interface ReassignRouteRequest { newTruckId: string }

/** Every error response has at least `error`. */
export interface ErrorBody { error: string }
/** POST /api/routes 409: the only conflict body that names the actor correctly. */
export interface CreateConflictBody extends ErrorBody { currentRouteId: string; assignedBy?: string }
/** PATCH 409 before the delay. lastModifiedBy ignores reassignedBy, so it can be wrong. */
export interface VersionConflictBody extends ErrorBody { currentVersion: number; yourVersion: number; lastModifiedBy: string }
/** PATCH 409 after the delay (quirk 8). No actor at all. */
export interface ProcessingConflictBody extends ErrorBody { currentVersion: number }

// Route events reach everyone, including the dispatcher who made the change.
export interface WsRouteAssigned { type: 'route_assigned'; route: Route; truckId: string; assignedBy: string; truckVersion: number; timestamp: number }
export interface WsRouteUpdated { type: 'route_updated'; route: Route; updatedBy: string; timestamp: number }
export interface WsRouteReassigned { type: 'route_reassigned'; route: Route; oldTruckId?: string; newTruckId: string; reassignedBy: string; timestamp: number }
