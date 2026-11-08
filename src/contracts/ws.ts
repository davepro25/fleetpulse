import { z } from 'zod';
import { WsFleetResetSchema, WsTruckAlertSchema } from './fleet';
import {
  WsDispatcherJoinedSchema,
  WsDispatcherLeftSchema,
  WsDispatcherViewingSchema,
  WsRegisteredSchema,
} from './presence';
import { WsRouteAssignedSchema, WsRouteReassignedSchema, WsRouteUpdatedSchema } from './routes';

export const WsInboundSchema = z.discriminatedUnion('type', [
  WsRegisteredSchema,
  WsDispatcherJoinedSchema,
  WsDispatcherLeftSchema,
  WsDispatcherViewingSchema,
  WsRouteAssignedSchema,
  WsRouteUpdatedSchema,
  WsRouteReassignedSchema,
  WsTruckAlertSchema,
  WsFleetResetSchema,
  z.object({ type: z.literal('pong'), timestamp: z.number() }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type WsInbound = z.infer<typeof WsInboundSchema>;

export type WsOutbound =
  | { type: 'register_dispatcher'; dispatcherId: string; name: string }
  | { type: 'ping' }
  | { type: 'viewing_truck'; truckId: string | null };
