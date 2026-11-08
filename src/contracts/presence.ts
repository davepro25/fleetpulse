// Dispatcher presence over WebSocket /ws. There is no "list online dispatchers" message.

/** Reply to our register_dispatcher. */
export interface WsRegistered { type: 'registered'; dispatcherId: string }
/** Excludes the sender. */
export interface WsDispatcherJoined { type: 'dispatcher_joined'; dispatcherId: string; name: string; timestamp: number; activeDispatchers: number }
/** Reaches everyone incl. the sender; 20% arrive 10 s late (quirk 6). timestamp = send time. */
export interface WsDispatcherLeft { type: 'dispatcher_left'; dispatcherId: string; timestamp: number; activeDispatchers: number }
/** Excludes the sender. truckId null = viewing nothing. No name field. */
export interface WsDispatcherViewing { type: 'dispatcher_viewing'; dispatcherId: string; truckId: string | null; timestamp: number }
