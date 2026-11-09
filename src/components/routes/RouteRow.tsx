import { useState } from 'react';
import type { Route, RouteStatus, TruckStatus } from '../../contracts';
import { useSession } from '../../context/SessionContext';
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
} from '../../mutations/routes';
import { useTruckName } from '../../queries/fleet';
import { displayName } from '../../utils/identity';
import { ConfirmDialog } from '../ConfirmDialog';
import { ROUTE_STATUS_TONE } from '../fleet/statusStyle';
import { Alert, Badge, Button, inputClass } from '../ui';
import { TruckOption } from './TruckOption';

const ACTION: Record<RouteStatus, { label: string; variant: 'primary' | 'danger' }> = {
  assigned: { label: 'Assign', variant: 'primary' },
  'in-progress': { label: 'Start', variant: 'primary' },
  completed: { label: 'Complete', variant: 'primary' },
  cancelled: { label: 'Cancel route', variant: 'danger' },
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
  const { identity } = useSession();
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
    <li className="grid gap-2 rounded-md border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{route.destination}</p>
          <p className="text-xs text-slate-500">
            {route.id} · {truckName}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Badge tone={ROUTE_STATUS_TONE[route.status]}>{route.status}</Badge>
          <Badge>{route.priority}</Badge>
        </div>
      </div>
      {route.notes && <p className="text-sm text-slate-600">{route.notes}</p>}

      {isActive(route) && (
        <div className="flex flex-wrap items-center gap-2">
          {nextStatuses(route.status).map((to) => (
            <Button
              key={to}
              variant={ACTION[to].variant}
              disabled={saving}
              onClick={() => choose({ type: 'status', to, version: route._version })}
            >
              {ACTION[to].label}
            </Button>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <select
              aria-label={`Move ${route.id} to another truck`}
              className={`${inputClass} w-36`}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={saving}
            >
              <option value="">Move to…</option>
              {assignableTruckIds(statuses, routes).map((id) => (
                <TruckOption key={id} id={id} />
              ))}
            </select>
            <Button
              disabled={saving || !target}
              onClick={() => choose({ type: 'reassign', truckId: target, version: route._version })}
            >
              Reassign
            </Button>
          </span>
        </div>
      )}

      {saving && <p className="text-xs text-slate-500">Saving… the server takes up to a second.</p>}
      {error && <Alert>{mutationErrorMessage(error, identity.id)}</Alert>}

      {pending && (
        <ConfirmDialog
          title={pending.type === 'status' ? `${ACTION[pending.to].label}?` : 'Reassign route?'}
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
