import { z } from 'zod';

export const RouteStatusSchema = z.enum(['assigned', 'in-progress', 'completed', 'cancelled']);
export type RouteStatus = z.infer<typeof RouteStatusSchema>;

export const RouteSchema = z.object({
  id: z.string(),
  truckId: z.string(),
  destination: z.string(),
  priority: z.string(),
  notes: z.string(),
  status: RouteStatusSchema,
  assignedBy: z.string(),
  assignedAt: z.number(),
  lastModifiedBy: z.string().optional(),
  lastModifiedAt: z.number().optional(),
  reassignedBy: z.string().optional(),
  reassignedAt: z.number().optional(),
  _version: z.number(),
});
export type Route = z.infer<typeof RouteSchema>;

export const RoutesResponseSchema = z.object({
  routes: z.array(RouteSchema),
  timestamp: z.number(),
});

export interface CreateRouteRequest {
  truckId: string;
  destination: string;
  priority?: string;
  notes?: string;
}

export interface UpdateRouteRequest {
  status?: RouteStatus;
  notes?: string;
  priority?: string;
}

export interface ReassignRouteRequest {
  newTruckId: string;
}

export const CreateConflictBodySchema = z.object({
  error: z.string(),
  currentRouteId: z.string(),
  assignedBy: z.string().optional(),
});

// lastModifiedBy ignores reassignedBy (server.js line 300), so after a reassign it names the wrong person.
export const VersionConflictBodySchema = z.object({
  error: z.string(),
  currentVersion: z.number(),
  yourVersion: z.number(),
  lastModifiedBy: z.string(),
});

// Sent after the PATCH delay (quirk 8). Carries no actor at all.
export const ProcessingConflictBodySchema = z.object({
  error: z.string(),
  currentVersion: z.number(),
});

// Route events are broadcast to everyone, including the dispatcher who made the change.
export const WsRouteAssignedSchema = z.object({
  type: z.literal('route_assigned'),
  route: RouteSchema,
  assignedBy: z.string(),
  timestamp: z.number(),
});

export const WsRouteUpdatedSchema = z.object({
  type: z.literal('route_updated'),
  route: RouteSchema,
  updatedBy: z.string(),
  timestamp: z.number(),
});

export const WsRouteReassignedSchema = z.object({
  type: z.literal('route_reassigned'),
  route: RouteSchema,
  oldTruckId: z.string().optional(),
  newTruckId: z.string(),
  reassignedBy: z.string(),
  timestamp: z.number(),
});
