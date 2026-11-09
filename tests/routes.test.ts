import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Route, RouteStatus, TruckStatus } from '../src/contracts';
import { conflictOwner } from '../src/domain/routes/conflicts';
import {
  assignableTruckIds,
  canTransition,
  reassignBlockedReason,
} from '../src/domain/routes/transitions';
import { validateRouteForm } from '../src/domain/routes/validation';
import { QUERY_KEYS } from '../src/queries/keys';
import { applyRouteChange } from '../src/queries/routes';
import { useAuditStore } from '../src/stores/auditStore';
import rest from './fixtures/rest.json';

const created = rest.createRoute201.body as Route; // route_1 on truck_1, v1, assigned by Dana
const reassigned = rest.routesAfterReassign.body.routes[0] as Route; // v2, moved to truck_4 by Eli

const statuses: Record<string, TruckStatus> = {
  truck_1: 'active',
  truck_4: 'idle',
  truck_5: 'active',
  truck_7: 'maintenance',
};

describe('route rules', () => {
  it('allows only assigned → in-progress → completed, and cancel before completion', () => {
    const all: RouteStatus[] = ['assigned', 'in-progress', 'completed', 'cancelled'];
    const allowed = all.flatMap((from) =>
      all.filter((to) => canTransition(from, to)).map((to) => `${from}→${to}`),
    );

    expect(allowed).toEqual([
      'assigned→in-progress',
      'assigned→cancelled',
      'in-progress→completed',
      'in-progress→cancelled',
    ]);
  });

  it('blocks reassigning finished routes and onto busy, maintenance or the same truck', () => {
    const routes = [created, { ...created, id: 'route_2', truckId: 'truck_5' }];

    expect(reassignBlockedReason(created, 'truck_4', statuses, routes)).toBeNull();
    expect(
      reassignBlockedReason({ ...created, status: 'completed' }, 'truck_4', statuses, routes),
    ).toMatch(/completed/);
    expect(reassignBlockedReason(created, 'truck_1', statuses, routes)).toMatch(/same/i);
    expect(reassignBlockedReason(created, 'truck_7', statuses, routes)).toMatch(/maintenance/);
    expect(reassignBlockedReason(created, 'truck_5', statuses, routes)).toMatch(/already/);

    expect(assignableTruckIds(statuses, routes)).toEqual(['truck_4']);
  });

  it('validates the create form: trims, requires a destination, checks enums and the truck', () => {
    const valid = validateRouteForm(
      { truckId: 'truck_4', destination: '  Dizengoff 50 ', priority: 'high', notes: '' },
      ['truck_4'],
    );
    expect(valid).toEqual({
      ok: true,
      value: { truckId: 'truck_4', destination: 'Dizengoff 50', priority: 'high', notes: '' },
    });

    const invalid = validateRouteForm(
      { truckId: 'truck_7', destination: ' ', priority: 'urgent', notes: 'x'.repeat(501) },
      ['truck_4'],
    );
    expect(invalid.ok).toBe(false);
    expect(!invalid.ok && Object.keys(invalid.errors).sort()).toEqual([
      'destination',
      'notes',
      'priority',
      'truckId',
    ]);
  });
});

describe('conflicts', () => {
  it('names who really changed the route, even when the 409 body names someone else', () => {
    // The real 409 says lastModifiedBy: Dana, but Eli reassigned the route after her.
    expect(rest.patch409Version.body.lastModifiedBy).toBe('Dana~aaaa1111');

    const byRoute = conflictOwner([reassigned], { routeId: 'route_1' });
    expect(byRoute.actor).toMatchObject({ dispatcherId: 'Eli~bbbb2222', action: 'reassigned' });

    const byTruck = conflictOwner([reassigned], { truckId: 'truck_4' }); // create/reassign onto a busy truck
    expect(byTruck.route?.id).toBe('route_1');
    expect(byTruck.actor?.dispatcherId).toBe('Eli~bbbb2222');
  });
});

describe('route cache and audit log', () => {
  beforeEach(() => useAuditStore.getState().clear());

  const setup = () => {
    const client = new QueryClient();
    client.setQueryData(QUERY_KEYS.routes, [created]);
    return client;
  };
  const cached = (client: QueryClient) => client.getQueryData(QUERY_KEYS.routes);

  // Our HTTP response and the WS echo of the same change carry the same route version, in either
  // order (the server broadcasts before it responds), so applying it twice must change nothing.
  it('records a change once when both the response and the WS echo arrive', () => {
    const client = setup();

    applyRouteChange(client, reassigned);
    const afterFirst = cached(client);
    applyRouteChange(client, reassigned);

    expect(cached(client)).toBe(afterFirst);
    expect(cached(client)).toEqual([reassigned]);
    expect(useAuditStore.getState().entries).toHaveLength(1);
  });

  it('ignores an event older than what the cache already has', () => {
    const client = setup();
    applyRouteChange(client, reassigned);
    applyRouteChange(client, created);

    expect(cached(client)).toEqual([reassigned]);
  });
});
