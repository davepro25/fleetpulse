import { useState } from 'react';
import type { Route, RouteStatus, TruckStatus } from '../../contracts';
import { useApp } from '../../context/AppContext';
import { lastActor } from '../../domain/routes/conflicts';
import {
  assignableTruckIds,
  isActive,
  nextStatuses,
  reassignBlockedReason,
  statusChangeBlockedReason,
} from '../../domain/routes/transitions';
import {
  mutationErrorMessage,
  useReassignRoute,
  useUpdateRouteStatus,
} from '../../hooks/useRouteMutations';
import { useTruckName } from '../../queries/fleet';
import { displayName } from '../../utils/identity';
import { ConfirmDialog } from '../ConfirmDialog';
import { TruckOption } from './TruckOption';

const ACTION_LABEL: Record<RouteStatus, string> = {
  assigned: 'Assign',
  'in-progress': 'Start',
  completed: 'Complete',
  cancelled: 'Cancel route',
};

/** What the dispatcher is about to confirm, with the route version they saw when deciding. */
type PendingAction =
  | { type: 'status'; to: RouteStatus; version: number }
  | { type: 'reassign'; truckId: string; version: number };

interface Props {
  route: Route;
  routes: Route[];
  statuses: Record<string, TruckStatus>;
}

export function RouteRow({ route, routes, statuses }: Props) {
  const { identity } = useApp();
  const update = useUpdateRouteStatus();
  const reassign = useReassignRoute();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [target, setTarget] = useState('');
  const truckName = useTruckName(route.truckId);
  const targetName = useTruckName(pending?.type === 'reassign' ? pending.truckId : '');

  const saving = update.isPending || reassign.isPending;
  const error = update.error ?? reassign.error;

  const run = (action: PendingAction) => {
    update.reset();
    reassign.reset();
    if (action.type === 'status') {
      update.mutate({ routeId: route.id, version: action.version, status: action.to });
    } else {
      reassign.mutate({ route, truckId: action.truckId });
    }
  };

  // Starting a route is routine; completing, cancelling and reassigning need a confirmation.
  const choose = (action: PendingAction) =>
    action.type === 'status' && action.to === 'in-progress' ? run(action) : setPending(action);

  return (
    <li className="route">
      <div>
        <strong>{route.destination}</strong> · {truckName} · {route.status} · {route.priority}
      </div>
      {route.notes && <div className="muted">{route.notes}</div>}

      {isActive(route) && (
        <div className="route-actions">
          {nextStatuses(route.status).map((to) => (
            <button
              key={to}
              disabled={saving}
              onClick={() => choose({ type: 'status', to, version: route._version })}
            >
              {ACTION_LABEL[to]}
            </button>
          ))}
          <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={saving}>
            <option value="">Move to…</option>
            {assignableTruckIds(statuses, routes).map((id) => (
              <TruckOption key={id} id={id} />
            ))}
          </select>
          <button
            disabled={saving || !target}
            onClick={() => choose({ type: 'reassign', truckId: target, version: route._version })}
          >
            Reassign
          </button>
          {saving && <span className="muted">Saving…</span>}
        </div>
      )}

      {error && (
        <p role="alert" className="warn">
          {mutationErrorMessage(error, identity.id)}
        </p>
      )}

      {pending && (
        <ConfirmDialog
          title={pending.type === 'status' ? `${ACTION_LABEL[pending.to]}?` : 'Reassign route?'}
          disabledReason={blockedReason(pending, route, routes, statuses)}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            run(pending);
            setPending(null);
            setTarget('');
          }}
        >
          {pending.type === 'status'
            ? `${route.id} (${route.destination}) will become ${pending.to}.`
            : `${route.id} (${route.destination}) moves from ${truckName} to ${targetName}.`}
        </ConfirmDialog>
      )}
    </li>
  );
}

// Re-evaluated on every render: a WS update can invalidate the action while the dialog is open.
function blockedReason(
  pending: PendingAction,
  route: Route,
  routes: Route[],
  statuses: Record<string, TruckStatus>,
): string | null {
  if (route._version !== pending.version) {
    const actor = lastActor(route);
    return `${displayName(actor.dispatcherId)} ${actor.action} this route while this was open. Cancel and review.`;
  }
  return pending.type === 'status'
    ? statusChangeBlockedReason(route, pending.to)
    : reassignBlockedReason(route, pending.truckId, statuses, routes);
}
