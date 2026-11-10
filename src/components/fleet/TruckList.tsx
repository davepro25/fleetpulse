import { memo } from 'react';
import type { SensorFault } from '../../domain/telemetry/detectors';
import { isLowFuel } from '../../domain/telemetry/detectors';
import { PROFILES } from '../../domain/telemetry/profiles';
import { useTruckName } from '../../queries/fleet';
import { useTruck, useTruckIds } from '../../stores/telemetryStore';
import { formatSensor } from '../../utils/format';
import { ViewerBadge } from '../presence/ViewerBadge';
import { Badge, Muted } from '../ui';
import { TabCount } from '../SidebarTabs';
import { TRUCK_STATUS_TONE } from './statusStyle';

interface Props {
  selectedId: string | null;
  onSelect(id: string): void;
}

export function TruckList({ selectedId, onSelect }: Props) {
  const ids = useTruckIds();

  return (
    <>
      {ids.length === 0 ? (
        <Muted>Waiting for telemetry…</Muted>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="sticky top-0 bg-slate-50 px-2 py-2 font-semibold first:rounded-l-md last:rounded-r-md">
                Truck
              </th>
              <th className="sticky top-0 bg-slate-50 px-2 py-2 font-semibold first:rounded-l-md last:rounded-r-md">
                Status
              </th>
              <th className="sticky top-0 bg-slate-50 px-2 py-2 font-semibold first:rounded-l-md last:rounded-r-md">
                Speed
              </th>
              <th className="sticky top-0 bg-slate-50 px-2 py-2 font-semibold first:rounded-l-md last:rounded-r-md">
                Fuel
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ids.map((id) => (
              <TruckRow key={id} id={id} selected={id === selectedId} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

export function TruckCount() {
  return <TabCount value={useTruckIds().length} />;
}

const TruckRow = memo(function TruckRow({
  id,
  selected,
  onSelect,
}: {
  id: string;
  selected: boolean;
  onSelect(id: string): void;
}) {
  const truck = useTruck(id);
  const name = useTruckName(id);
  if (!truck) return null;

  const speed = formatSensor(truck.speed, 'km/h');
  const fuel = formatSensor(truck.fuel, '%');

  return (
    <tr className={selected ? 'bg-indigo-50' : undefined}>
      <td className="px-2 py-1.5">
        <button
          className="cursor-pointer rounded font-medium text-slate-900 hover:text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600"
          aria-pressed={selected}
          onClick={() => onSelect(id)}
        >
          {name}
        </button>{' '}
        <ViewerBadge truckId={id} />
      </td>
      <td className="px-2 py-1.5">
        <Badge tone={TRUCK_STATUS_TONE[truck.status]} dot>
          {truck.status}
        </Badge>
      </td>
      <td className="px-2 py-1.5 tabular-nums">
        {speed.text} <FaultBadge fault={truck.speed.fault} detail={speed.warning} />
      </td>
      <td className="px-2 py-1.5 tabular-nums">
        <span className="inline-flex flex-wrap items-center gap-1">
          {fuel.text}
          <FaultBadge fault={truck.fuel.fault} detail={fuel.warning} />
          {isLowFuel(truck.fuel, PROFILES.truck) && <Badge tone="red">Low fuel</Badge>}
        </span>
      </td>
    </tr>
  );
});

function FaultBadge({ fault, detail }: { fault: SensorFault | null; detail: string | null }) {
  if (!fault || !detail) return null;
  return (
    <Badge tone="amber" title={detail}>
      {fault.kind === 'out_of_range' ? 'Sensor fault' : 'Glitch?'}
    </Badge>
  );
}
