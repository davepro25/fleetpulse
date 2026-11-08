import { z } from 'zod';

// activeDispatchers is left out on purpose: it counts ghosts and is zeroed by reset.

export const WsRegisteredSchema = z.object({
  type: z.literal('registered'),
  dispatcherId: z.string(),
});

export const WsDispatcherJoinedSchema = z.object({
  type: z.literal('dispatcher_joined'),
  dispatcherId: z.string(),
  name: z.string(),
  timestamp: z.number(),
});

// 20% arrive 10 s late (quirk 6), and timestamp is the send time, not the disconnect time.
export const WsDispatcherLeftSchema = z.object({
  type: z.literal('dispatcher_left'),
  dispatcherId: z.string(),
  timestamp: z.number(),
});

// dispatcherId is null when the sender never registered: such messages are rejected.
export const WsDispatcherViewingSchema = z.object({
  type: z.literal('dispatcher_viewing'),
  dispatcherId: z.string(),
  truckId: z.string().nullable(),
  timestamp: z.number(),
});
