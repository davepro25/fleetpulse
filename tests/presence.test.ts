import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Route, WsInbound } from '../src/contracts';
import { applyPresence, GHOST_GRACE_MS, type Roster } from '../src/domain/presence';
import { handleFleetReset } from '../src/live';
import { QUERY_KEYS } from '../src/queries/keys';
import { useAuditStore } from '../src/stores/auditStore';
import { usePresenceStore } from '../src/stores/presenceStore';
import { useTelemetryStore } from '../src/stores/telemetryStore';
import rest from './fixtures/rest.json';
import sse from './fixtures/sse.json';
import ws from './fixtures/ws.json';

const SELF = 'Dana~aaaa1111';
const ELI = 'Eli~bbbb2222';
const joined = ws.dispatcher_joined as WsInbound & { type: 'dispatcher_joined' }; // Eli
const left = ws.dispatcher_left as WsInbound & { type: 'dispatcher_left' }; // Eli

const apply = (roster: Roster, message: unknown, now: number) =>
  applyPresence(roster, message as Parameters<typeof applyPresence>[1], now, SELF);

describe('presence', () => {
  it('ignores the late leave of a ghost: Eli reconnected before the old socket was announced closed', () => {
    const [join, lateLeave] = ws.ghostLeaveAfterReconnect.observerLog; // the real capture, 10 s apart
    let roster = apply({}, join!.msg, join!.receivedAt);
    roster = apply(roster, lateLeave!.msg, lateLeave!.receivedAt);

    expect(roster[ELI]?.name).toBe('Eli');
  });

  it('removes a dispatcher whose leave comes after the grace window', () => {
    const roster = apply(apply({}, joined, 0), left, GHOST_GRACE_MS);
    expect(roster[ELI]).toBeUndefined();
  });

  it('leaves for unknown ids and repeated leaves change nothing', () => {
    const empty: Roster = {};
    expect(apply(empty, left, 0)).toBe(empty);

    const once = apply(apply({}, joined, 0), left, GHOST_GRACE_MS);
    expect(apply(once, left, GHOST_GRACE_MS + 1)).toBe(once);
  });

  it('learns a dispatcher it never saw join from dispatcher_viewing, and clears the truck on null', () => {
    let roster = apply({}, ws.dispatcher_viewing, 0);
    expect(roster[ELI]).toMatchObject({ name: 'Eli', viewingTruckId: 'truck_3' });

    roster = apply(roster, ws.dispatcher_viewing_null, 1);
    expect(roster[ELI]?.viewingTruckId).toBeNull();
  });

  it('ignores messages about itself (our own ghost leave arrives after a reconnect)', () => {
    const roster = apply({}, { ...joined, dispatcherId: SELF }, 0);
    expect(roster).toEqual({});
  });
});

describe('fleet_reset', () => {
  it('clears routes, audit, roster and telemetry, refetches, and registers again', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(QUERY_KEYS.routes, [rest.createRoute201.body as Route]);
    useAuditStore.getState().record({
      key: 'route_1@1',
      routeId: 'route_1',
      kind: 'assigned',
      actor: SELF,
      at: 0,
      truckId: 'truck_1',
      status: 'assigned',
    });
    usePresenceStore.getState().apply(joined, 0, SELF);
    useTelemetryStore.getState().ingest(sse.telemetry as never, 0);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const socket = { reregister: vi.fn(), sendViewing: vi.fn(), close: vi.fn() };

    handleFleetReset(queryClient, socket);

    // Route ids restart at route_1 with version 1: old entries would hide the new routes.
    expect(queryClient.getQueryData(QUERY_KEYS.routes)).toEqual([]);
    expect(useAuditStore.getState().entries).toEqual([]);
    expect(usePresenceStore.getState().roster).toEqual({});
    expect(useTelemetryStore.getState().fleet).toEqual({});
    expect(invalidate).toHaveBeenCalled();
    expect(socket.reregister).toHaveBeenCalledOnce();
  });
});
