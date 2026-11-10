import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { FleetFilter } from '../../domain/fleetFilter';
import { useTelemetryStore, useTruck } from '../../stores/telemetryStore';
import { useFilteredTruckIds } from './FleetFilters';
import { MARKER_RING, STATUS_COLOR } from './statusStyle';
import { TruckMarker } from './TruckMarker';

const TEL_AVIV: [number, number] = [32.0853, 34.7818];

interface Props {
  selectedId: string | null;
  filter: FleetFilter;
  onSelect(id: string): void;
}

// Re-renders only when the set of shown trucks changes; each marker subscribes to its own truck.
export function FleetMap({ selectedId, filter, onSelect }: Props) {
  const ids = useFilteredTruckIds(filter);

  return (
    <>
      <MapContainer center={TEL_AVIV} zoom={13} className="h-full w-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {selectedId && <SelectedPath id={selectedId} />}
        {selectedId && <PanToSelected id={selectedId} />}
        {ids.map((id) => (
          <TruckMarker key={id} id={id} selected={id === selectedId} onSelect={onSelect} />
        ))}
      </MapContainer>
      <Legend />
    </>
  );
}

// Only for the selected truck: batch points are jitter around the current position.
function SelectedPath({ id }: { id: string }) {
  const truck = useTruck(id);
  if (!truck) return null;
  return <Polyline positions={truck.path} pathOptions={{ color: '#4f46e5', weight: 3 }} />;
}

function PanToSelected({ id }: { id: string }) {
  const map = useMap();
  useEffect(() => {
    const truck = useTelemetryStore.getState().fleet[id];
    if (truck) map.panTo([truck.location.lat, truck.location.lng]);
  }, [id, map]);
  return null;
}

function Legend() {
  const swatch = (fill: string, ring: string, label: string) => (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="size-3 rounded-full border-2"
        style={{ background: fill, borderColor: ring }}
      />
      {label}
    </li>
  );

  return (
    <ul className="absolute bottom-3 left-3 z-[1000] grid gap-1 rounded-md bg-white/95 px-3 py-2 text-xs text-slate-700 shadow ring-1 ring-slate-200">
      {swatch(STATUS_COLOR.active, MARKER_RING.none, 'Active')}
      {swatch(STATUS_COLOR.idle, MARKER_RING.none, 'Idle')}
      {swatch(STATUS_COLOR.maintenance, MARKER_RING.none, 'Maintenance')}
      {swatch('#fff', MARKER_RING.lowFuel, 'Red ring: low fuel')}
      {swatch('#fff', MARKER_RING.sensorFault, 'Amber ring: sensor fault')}
    </ul>
  );
}
