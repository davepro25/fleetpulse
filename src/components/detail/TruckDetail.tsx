import { useEffect, type ReactNode } from 'react';
import type { TruckAlert } from '../../contracts';
import { useSession } from '../../context/SessionContext';
import { isLowFuel } from '../../domain/telemetry/detectors';
import { PROFILES } from '../../domain/telemetry/profiles';
import { activeRouteForTruck } from '../../domain/routes/transitions';
import { useTelemetryHistory, useTruckDetail, useTruckName } from '../../queries/fleet';
import { useRoutes } from '../../queries/routes';
import { useTruckAlerts } from '../../stores/alertStore';
import { useViewersOf } from '../../stores/presenceStore';
import { useTelemetryStore, useTruck } from '../../stores/telemetryStore';
import { formatSensor } from '../../utils/format';
import { displayName } from '../../utils/identity';
import { ROUTE_STATUS_TONE, TRUCK_STATUS_TONE } from '../fleet/statusStyle';
import { Badge, Muted, Panel, type Tone } from '../ui';
import { AlertForm } from './AlertForm';
import { TelemetryCharts } from './TelemetryCharts';

const SEVERITY_TONE: Record<string, Tone> = { info: 'blue', warning: 'amber', critical: 'red' };

export function TruckDetail({ id }: { id: string }) {
  const truck = useTruck(id);
  const name = useTruckName(id);
  const detail = useTruckDetail(id);
  const { data: history } = useTelemetryHistory(id);
  const viewers = useViewersOf(id);

  useEffect(() => {
    if (history) useTelemetryStore.getState().seed(id, history);
  }, [id, history]);

  if (!truck) return null;
  const speed = formatSensor(truck.speed, 'km/h');
  const fuel = formatSensor(truck.fuel, '%');

  return (
    <Panel
      title={name}
      action={
        <Badge tone={TRUCK_STATUS_TONE[truck.status]} dot>
          {truck.status}
        </Badge>
      }
    >
      {viewers.length > 0 && (
        <p className="mb-4 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          Also viewing: <span className="font-medium">{viewers.join(', ')}</span>
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="grid content-start gap-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Speed" warning={speed.warning}>
              {speed.text}
            </Stat>
            <Stat label="Fuel" warning={fuel.warning}>
              {fuel.text}
              {isLowFuel(truck.fuel, PROFILES.truck) && (
                <>
                  {' '}
                  <Badge tone="red">Low fuel</Badge>
                </>
              )}
            </Stat>
            <Stat label="Engine temp">{Math.round(truck.engineTemp)} °C</Stat>
            <Stat label="Mileage">
              {detail.data
                ? `${detail.data.mileage.toLocaleString()} km`
                : detail.isError
                  ? '—'
                  : '…'}
            </Stat>
            <Stat label="Last reading">{new Date(truck.lastReadingAt).toLocaleTimeString()}</Stat>
          </dl>

          <Section title="Route">
            <AssignedRoute truckId={id} />
          </Section>

          <Section title="Alerts">
            <div className="grid gap-3">
              <AlertForm truckId={id} />
              <AlertList truckId={id} />
            </div>
          </Section>
        </div>

        <Section title="Last 5 minutes">
          <TelemetryCharts samples={truck.samples} />
        </Section>
      </div>
    </Panel>
  );
}

function Stat({
  label,
  warning = null,
  children,
}: {
  label: string;
  warning?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-base font-semibold tabular-nums text-slate-900">{children}</dd>
      {warning && <dd className="text-xs text-amber-800">{warning}</dd>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function AssignedRoute({ truckId }: { truckId: string }) {
  const { data: routes = [] } = useRoutes();
  const route = activeRouteForTruck(routes, truckId);
  if (!route) return <Muted>No active route. Assign one in the Routes tab.</Muted>;

  return (
    <div className="grid gap-1 text-sm text-slate-700">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">{route.destination}</span>
        <Badge tone={ROUTE_STATUS_TONE[route.status]}>{route.status}</Badge>
        <Badge>{route.priority} priority</Badge>
      </p>
      <p className="text-xs text-slate-500">
        {route.id} · assigned by {displayName(route.assignedBy)} at{' '}
        {new Date(route.assignedAt).toLocaleTimeString()}
      </p>
      {route.notes && <p>{route.notes}</p>}
    </div>
  );
}

function AlertList({ truckId }: { truckId: string }) {
  const alerts = useTruckAlerts(truckId);
  if (alerts.length === 0)
    return <Muted>No alerts sent to this truck since this tab opened.</Muted>;
  return (
    <ol className="grid gap-1.5 text-sm">
      {alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} />
      ))}
    </ol>
  );
}

function AlertRow({ alert }: { alert: TruckAlert }) {
  const { identity } = useSession();
  const who = !alert.sentBy
    ? 'Unknown'
    : alert.sentBy === identity.id
      ? 'You'
      : displayName(alert.sentBy);
  return (
    <li className="flex flex-wrap items-baseline gap-2">
      <time className="text-xs tabular-nums text-slate-500">
        {new Date(alert.timestamp).toLocaleTimeString()}
      </time>
      <Badge tone={SEVERITY_TONE[alert.severity] ?? 'neutral'}>{alert.severity}</Badge>
      <span className="text-slate-700">
        <strong className="font-medium text-slate-900">{who}</strong>: {alert.message}
      </span>
    </li>
  );
}
