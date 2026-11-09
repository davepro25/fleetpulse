import { memo } from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { isLowFuel } from '../../domain/telemetry/detectors';
import { PROFILES } from '../../domain/telemetry/profiles';
import { useTruckName } from '../../queries/fleet';
import { useTruck } from '../../stores/telemetryStore';
import { MARKER_RING, STATUS_COLOR } from './statusStyle';

interface Props {
  id: string;
  selected: boolean;
  onSelect(id: string): void;
}

export const TruckMarker = memo(function TruckMarker({ id, selected, onSelect }: Props) {
  const truck = useTruck(id);
  const name = useTruckName(id);
  if (!truck) return null;

  const lowFuel = isLowFuel(truck.fuel, PROFILES.truck);
  const sensorFault = truck.speed.fault !== null || truck.fuel.fault !== null;

  return (
    <CircleMarker
      center={[truck.location.lat, truck.location.lng]}
      radius={selected ? 11 : 8}
      pathOptions={{
        fillColor: STATUS_COLOR[truck.status],
        fillOpacity: 0.9,
        color: lowFuel
          ? MARKER_RING.lowFuel
          : sensorFault
            ? MARKER_RING.sensorFault
            : MARKER_RING.none,
        weight: lowFuel || sensorFault ? 3 : 1,
      }}
      eventHandlers={{ click: () => onSelect(id) }}
    >
      <Tooltip>
        {name} · {truck.status}
        {lowFuel && ' · low fuel'}
        {sensorFault && ' · sensor fault'}
      </Tooltip>
    </CircleMarker>
  );
});
