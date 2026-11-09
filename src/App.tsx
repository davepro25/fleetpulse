import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ConnectionBanner } from './components/ConnectionBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FleetMap } from './components/fleet/FleetMap';
import { TruckList } from './components/fleet/TruckList';
import { IdentityGate } from './components/IdentityGate';
import { AppProvider, type AppServices } from './context/AppContext';
import { startLive } from './live';
import type { Identity } from './utils/identity';

export function App() {
  return <IdentityGate>{(identity) => <Dashboard identity={identity} />}</IdentityGate>;
}

function Dashboard({ identity }: { identity: Identity }) {
  const queryClient = useQueryClient();
  const [services, setServices] = useState<AppServices | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const live = startLive({ queryClient, identity });
    setServices({ identity, socket: live.socket });
    return live.stop;
  }, [queryClient, identity]);

  if (!services) return null;

  return (
    <AppProvider value={services}>
      <div className="layout">
        <ConnectionBanner dispatcherName={identity.name} />
        <main className="map-panel">
          <ErrorBoundary name="Map">
            <FleetMap selectedId={selectedId} onSelect={setSelectedId} />
          </ErrorBoundary>
        </main>
        <aside className="side-panel">
          <ErrorBoundary name="Truck list">
            <TruckList selectedId={selectedId} onSelect={setSelectedId} />
          </ErrorBoundary>
          <section>Routes (Stage 5)</section>
          <section>Dispatchers (Stage 6)</section>
        </aside>
        <section className="detail-panel">Truck detail (Stage 7)</section>
      </div>
    </AppProvider>
  );
}
