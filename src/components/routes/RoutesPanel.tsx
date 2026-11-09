import type { ReactNode } from 'react';
import type { Route, TruckStatus } from '../../contracts';
import { isActive } from '../../domain/routes/transitions';
import { useActiveRouteCount, useRoutes } from '../../queries/routes';
import { useTruckStatuses } from '../../stores/telemetryStore';
import { Alert, Button, Muted } from '../ui';
import { TabCount } from '../SidebarTabs';
import { CreateRouteForm } from './CreateRouteForm';
import { RouteRow } from './RouteRow';

const FINISHED_SHOWN = 5;

export function RoutesPanel({ selectedId }: { selectedId: string | null }) {
  const { data: routes = [], isError, refetch } = useRoutes();
  const statuses = useTruckStatuses();

  const active = routes.filter(isActive);
  const finished = routes
    .filter((route) => !isActive(route))
    .sort((a, b) => b.assignedAt - a.assignedAt)
    .slice(0, FINISHED_SHOWN);

  return (
    <div className="grid gap-4">
      <CreateRouteForm routes={routes} statuses={statuses} selectedId={selectedId} />

      {isError && (
        <Alert>
          Routes could not be loaded.{' '}
          <Button className="ml-2" onClick={() => void refetch()}>
            Retry
          </Button>
        </Alert>
      )}

      <RouteGroup title="Active" routes={active} all={routes} statuses={statuses}>
        <Muted>No active routes. Assign one above.</Muted>
      </RouteGroup>
      {finished.length > 0 && (
        <RouteGroup title="Recently finished" routes={finished} all={routes} statuses={statuses} />
      )}
    </div>
  );
}

export function ActiveRouteCount() {
  return <TabCount value={useActiveRouteCount()} />;
}

function RouteGroup({
  title,
  routes,
  all,
  statuses,
  children,
}: {
  title: string;
  routes: Route[];
  all: Route[];
  statuses: Record<string, TruckStatus>;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title} ({routes.length})
      </h3>
      {routes.length === 0 ? (
        children
      ) : (
        <ul className="grid gap-2">
          {routes.map((route) => (
            <RouteRow key={route.id} route={route} routes={all} statuses={statuses} />
          ))}
        </ul>
      )}
    </div>
  );
}
