import { useQuery } from '@tanstack/react-query';
import type { Route } from '../../contracts';
import { isActive } from '../../domain/routes/transitions';
import { routesQueryOptions } from '../../queries/routes';
import { useTruckStatuses } from '../../stores/telemetryStore';
import { AuditLog } from './AuditLog';
import { CreateRouteForm } from './CreateRouteForm';
import { RouteRow } from './RouteRow';

const FINISHED_SHOWN = 5;

export function RoutesPanel() {
  const { data: routes = [], isError, refetch } = useQuery(routesQueryOptions);
  const statuses = useTruckStatuses();

  const active = routes.filter(isActive);
  const finished = routes
    .filter((route) => !isActive(route))
    .sort((a, b) => b.assignedAt - a.assignedAt)
    .slice(0, FINISHED_SHOWN);

  return (
    <section className="routes">
      <h2>Routes</h2>
      <CreateRouteForm routes={routes} statuses={statuses} />
      {isError && (
        <p className="warn">
          Routes unavailable <button onClick={() => void refetch()}>Retry</button>
        </p>
      )}
      <RouteList title="Active" routes={active} all={routes} statuses={statuses} />
      <RouteList title="Recently finished" routes={finished} all={routes} statuses={statuses} />
      <AuditLog />
    </section>
  );
}

function RouteList({
  title,
  routes,
  all,
  statuses,
}: {
  title: string;
  routes: Route[];
  all: Route[];
  statuses: ReturnType<typeof useTruckStatuses>;
}) {
  if (routes.length === 0) return null;
  return (
    <>
      <h3>{title}</h3>
      <ul className="route-list">
        {routes.map((route) => (
          <RouteRow key={route.id} route={route} routes={all} statuses={statuses} />
        ))}
      </ul>
    </>
  );
}
