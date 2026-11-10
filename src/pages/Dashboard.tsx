import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { FleetMap } from '../components/fleet/FleetMap';
import { TruckCount, TruckList } from '../components/fleet/TruckList';
import { ActivityCount, AuditLog } from '../components/routes/AuditLog';
import { ActiveRouteCount, RoutesPanel } from '../components/routes/RoutesPanel';
import { TruckDetail } from '../components/detail/TruckDetail';
import { DispatcherCount, DispatcherRoster } from '../components/presence/DispatcherRoster';
import { SidebarTabs } from '../components/SidebarTabs';
import { Muted, Panel } from '../components/ui';
import { SessionProvider, type Session } from '../context/SessionContext';
import { startLive } from '../live';
import { useAuditStore } from '../stores/auditStore';
import type { Identity } from '../utils/identity';

interface Props {
  identity: Identity;
  onSignOut(): void;
}

export function Dashboard({ identity, onSignOut }: Props) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const live = startLive(queryClient, identity);
    setSession({ identity, socket: live.socket });
    return live.stop;
  }, [queryClient, identity]);

  // Tell the other dispatchers which truck we are looking at.
  useEffect(() => session?.socket.sendViewing(selectedId), [session, selectedId]);

  if (!session) return null;

  return (
    <SessionProvider value={session}>
      <div className="flex min-h-screen flex-col lg:h-screen">
        <ConnectionBanner
          dispatcherName={identity.name}
          onSignOut={() => {
            // The log describes "since this tab connected" for the previous identity.
            useAuditStore.getState().clear();
            onSignOut();
          }}
        />

        <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_460px]">
          <div className="flex min-h-0 flex-col gap-3">
            <div className="relative h-[55vh] overflow-hidden rounded-lg ring-1 ring-slate-200 lg:h-auto lg:flex-1">
              <ErrorBoundary name="Map">
                <FleetMap selectedId={selectedId} onSelect={setSelectedId} />
              </ErrorBoundary>
            </div>
            <div className="lg:max-h-[50%] lg:overflow-y-auto">
              {selectedId ? (
                // key: a crash in one truck's panel is forgotten when another truck is opened.
                <ErrorBoundary key={selectedId} name="Truck details">
                  <TruckDetail id={selectedId} />
                </ErrorBoundary>
              ) : (
                <Panel title="Truck details">
                  <Muted>Select a truck on the map or in the list.</Muted>
                </Panel>
              )}
            </div>
          </div>

          <aside className="flex min-h-0 flex-col">
            <SidebarTabs
              tabs={[
                {
                  id: 'trucks',
                  label: 'Trucks',
                  count: <TruckCount />,
                  content: (
                    <ErrorBoundary name="Trucks">
                      <TruckList selectedId={selectedId} onSelect={setSelectedId} />
                    </ErrorBoundary>
                  ),
                },
                {
                  id: 'routes',
                  label: 'Routes',
                  count: <ActiveRouteCount />,
                  content: (
                    <ErrorBoundary name="Routes">
                      <RoutesPanel selectedId={selectedId} />
                    </ErrorBoundary>
                  ),
                },
                {
                  id: 'activity',
                  label: 'Activity',
                  count: <ActivityCount />,
                  content: (
                    <ErrorBoundary name="Activity">
                      <AuditLog />
                    </ErrorBoundary>
                  ),
                },
                {
                  id: 'dispatchers',
                  label: 'Dispatchers',
                  count: <DispatcherCount />,
                  content: (
                    <ErrorBoundary name="Dispatchers">
                      <DispatcherRoster />
                    </ErrorBoundary>
                  ),
                },
              ]}
            />
          </aside>
        </div>
      </div>
    </SessionProvider>
  );
}
