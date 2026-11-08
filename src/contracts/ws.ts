// WebSocket /ws envelopes: the full inbound/outbound unions, built from each domain's events.
import type { WsFleetReset, WsTruckAlert } from './fleet';
import type { WsDispatcherJoined, WsDispatcherLeft, WsDispatcherViewing, WsRegistered } from './presence';
import type { WsRouteAssigned, WsRouteReassigned, WsRouteUpdated } from './routes';

export interface WsPong { type: 'pong'; timestamp: number }
/** Sent when the server cannot parse our message. Not in the spec's table. */
export interface WsError { type: 'error'; message: string }

export type WsInbound =
  | WsRegistered
  | WsDispatcherJoined
  | WsDispatcherLeft
  | WsDispatcherViewing
  | WsRouteAssigned
  | WsRouteUpdated
  | WsRouteReassigned
  | WsTruckAlert
  | WsFleetReset
  | WsPong
  | WsError;

export type WsOutbound =
  | { type: 'register_dispatcher'; dispatcherId: string; name: string }
  | { type: 'ping' }
  | { type: 'viewing_truck'; truckId: string | null };
