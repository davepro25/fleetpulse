import { TruckStatusSchema } from '../../contracts';
import { matchesFilter, type FleetFilter } from '../../domain/fleetFilter';
import { isActive } from '../../domain/routes/transitions';
import { PROFILES } from '../../domain/telemetry/profiles';
import { useRoutes } from '../../queries/routes';
import { useTruckIds } from '../../stores/telemetryStore';
import { Field, inputClass } from '../ui';

const FUEL_OPTIONS = [50, 25, PROFILES.truck.lowFuelPct];

export function useFilteredTruckIds(filter: FleetFilter): string[] {
  const { data: routes = [] } = useRoutes();
  const withRoute = new Set(routes.filter(isActive).map((route) => route.truckId));
  return useTruckIds((truck) => matchesFilter(truck, withRoute.has(truck.id), filter));
}

interface Props {
  filter: FleetFilter;
  onChange(filter: FleetFilter): void;
}

export function FleetFilters({ filter, onChange }: Props) {
  const set = <K extends keyof FleetFilter>(key: K, value: FleetFilter[K]) =>
    onChange({ ...filter, [key]: value });

  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      <Field label="Status">
        <select
          className={inputClass}
          value={filter.status}
          onChange={(e) => set('status', e.target.value as FleetFilter['status'])}
        >
          <option value="all">All</option>
          {TruckStatusSchema.options.map((status) => (
            <option key={status}>{status}</option>
          ))}
        </select>
      </Field>

      <Field label="Fuel">
        <select
          className={inputClass}
          value={filter.fuelBelow ?? ''}
          onChange={(e) => set('fuelBelow', e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Any</option>
          {FUEL_OPTIONS.map((pct) => (
            <option key={pct} value={pct}>
              Below {pct} %
            </option>
          ))}
        </select>
      </Field>

      <Field label="Route">
        <select
          className={inputClass}
          value={filter.route}
          onChange={(e) => set('route', e.target.value as FleetFilter['route'])}
        >
          <option value="all">All</option>
          <option value="assigned">With a route</option>
          <option value="unassigned">Without a route</option>
        </select>
      </Field>
    </div>
  );
}
