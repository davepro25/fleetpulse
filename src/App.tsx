import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { fleetQueryOptions } from './queries/fleet';
import { startLive } from './live';
import { AppProvider, type AppServices } from './context/AppContext';
import { useConnectionStore } from './stores/connectionStore';
import { IdentityGate } from './components/IdentityGate';
import type { Identity } from './utils/identity';

export function App() {
  return <IdentityGate>{(identity) => <Dashboard identity={identity} />}</IdentityGate>;
}

function Dashboard({ identity }: { identity: Identity }) {
  const queryClient = useQueryClient();
  const [services, setServices] = useState<AppServices | null>(null);

  useEffect(() => {
    const live = startLive({ queryClient, identity });
    setServices({ identity, socket: live.socket });
    return live.stop;
  }, [queryClient, identity]);

  if (!services) return null;

  return (
    <AppProvider value={services}>
      <div className="layout">
        <header className="banner">
          FleetPulse · {identity.name} · <StatusLine />
        </header>
        <main className="map-panel">Map (Stage 4)</main>
        <aside className="side-panel">
          <section>Trucks (Stage 4)</section>
          <section>Routes (Stage 5)</section>
          <section>Dispatchers (Stage 6)</section>
        </aside>
        <section className="detail-panel">Truck detail (Stage 7)</section>
      </div>
    </AppProvider>
  );
}

// Temporary: replaced by the Stage 4 ConnectionBanner.
function StatusLine() {
  const { sse, ws, wsRttMs } = useConnectionStore();
  const fleet = useQuery(fleetQueryOptions);
  const fleetText = fleet.data
    ? `${fleet.data.fleet.length} trucks`
    : fleet.isError
      ? 'failed'
      : 'loading';
  return (
    <span>
      SSE {sse} · WS {ws}
      {wsRttMs !== null && ` (${wsRttMs} ms)`} · fleet {fleetText}
      {fleet.isError && <button onClick={() => void fleet.refetch()}>Retry</button>}
    </span>
  );
}
