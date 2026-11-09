import 'leaflet/dist/leaflet.css';
import { MapContainer, Polyline, TileLayer } from 'react-leaflet';
import { useTruck, useTruckIds } from '../../stores/telemetryStore';
import { TruckMarker } from './TruckMarker';

const TEL_AVIV: [number, number] = [32.0853, 34.7818];

interface Props {
  selectedId: string | null;
  onSelect(id: string): void;
}

// Re-renders only when a truck appears; each marker subscribes to its own truck.
export function FleetMap({ selectedId, onSelect }: Props) {
  const ids = useTruckIds();

  return (
    <MapContainer center={TEL_AVIV} zoom={13} className="map">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {selectedId && <SelectedPath id={selectedId} />}
      {ids.map((id) => (
        <TruckMarker key={id} id={id} selected={id === selectedId} onSelect={onSelect} />
      ))}
    </MapContainer>
  );
}

// Only for the selected truck: batch points are jitter around the current position.
function SelectedPath({ id }: { id: string }) {
  const truck = useTruck(id);
  if (!truck) return null;
  return <Polyline positions={truck.path} pathOptions={{ color: '#534AB7', weight: 2 }} />;
}
