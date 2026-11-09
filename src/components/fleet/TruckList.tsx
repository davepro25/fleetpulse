import { memo } from 'react';
import type { TruckStatus } from '../../contracts';
import { isLowFuel } from '../../domain/telemetry/detectors';
import { profileFor } from '../../domain/telemetry/profiles';
import { useTruckName } from '../../queries/fleet';
import { useTruck, useTruckIds } from '../../stores/telemetryStore';
import { formatSensor, type SensorText } from '../../utils/format';
import { STATUS_COLOR } from './statusStyle';

interface Props {
  selectedId: string | null;
  onSelect(id: string): void;
}

export function TruckList({ selectedId, onSelect }: Props) {
  const ids = useTruckIds();
  if (ids.length === 0) return <p className="muted">Waiting for telemetry…</p>;

  return (
    <table className="truck-list">
      <thead>
        <tr>
          <th>Truck</th>
          <th>Status</th>
          <th>Speed</th>
          <th>Fuel</th>
        </tr>
      </thead>
      <tbody>
        {ids.map((id) => (
          <TruckRow key={id} id={id} selected={id === selectedId} onSelect={onSelect} />
        ))}
      </tbody>
    </table>
  );
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

  return (
    <tr className={selected ? 'selected' : undefined}>
      <td>
        <button className="link" aria-pressed={selected} onClick={() => onSelect(id)}>
          {name}
        </button>
      </td>
      <td>
        <StatusLabel status={truck.status} />
      </td>
      <td>
        <Reading value={formatSensor(truck.speed, 'km/h')} />
      </td>
      <td>
        <Reading value={formatSensor(truck.fuel, '%')} />
        {isLowFuel(truck.fuel, profileFor(id)) && <span className="badge-danger">Low fuel</span>}
      </td>
    </tr>
  );
});

function StatusLabel({ status }: { status: TruckStatus }) {
  return (
    <>
      <span className="status-dot" style={{ background: STATUS_COLOR[status] }} /> {status}
    </>
  );
}

function Reading({ value }: { value: SensorText }) {
  return (
    <>
      {value.text}
      {value.warning && <div className="reading-warning">{value.warning}</div>}
    </>
  );
}
