import { describe, expect, it } from 'vitest';
import { SseMessageSchema, WsInboundSchema } from '../src/contracts';
import sse from './fixtures/sse.json';
import ws from './fixtures/ws.json';

describe('contracts', () => {
  it('accepts every captured SSE message without dropping a real reading', () => {
    const captured = [
      sse.connected,
      sse.heartbeat,
      sse.telemetry,
      sse.gps_batch,
      sse.outOfOrder.message,
      ...sse.fuelGlitchSequence.messages,
      ...sse.speedStuckSequence.messages,
    ];
    for (const message of captured) {
      const parsed = SseMessageSchema.parse(message);
      if ('readings' in parsed && 'readings' in message) {
        expect(parsed.readings).toHaveLength(message.readings.length);
      }
    }
  });

  it('keeps the other readings when one reading in a frame is malformed', () => {
    const readings = [...sse.telemetry.readings];
    readings[3] = { ...readings[3]!, speed: 'fast' as unknown as number };

    const parsed = SseMessageSchema.parse({ ...sse.telemetry, readings });

    const ids = parsed.type === 'telemetry' ? parsed.readings.map((r) => r.truckId) : [];
    expect(ids).toEqual(sse.telemetry.readings.filter((_, i) => i !== 3).map((r) => r.truckId));
  });

  it('accepts every captured WS message but rejects viewing from an unregistered sender', () => {
    const captured = [
      ws.registered,
      ws.dispatcher_joined,
      ws.dispatcher_viewing,
      ws.dispatcher_viewing_null,
      ws.dispatcher_left,
      ws.route_assigned,
      ws.route_updated,
      ws.route_reassigned,
      ws.truck_alert,
      ws.fleet_reset,
      ws.pong,
      ws.error,
    ];
    for (const message of captured) expect(WsInboundSchema.parse(message).type).toBe(message.type);

    expect(WsInboundSchema.safeParse(ws.dispatcher_viewing_unregistered).success).toBe(false);
  });
});
