import { useShallow } from 'zustand/react/shallow';
import { useSession } from '../../context/SessionContext';
import { useTruckName } from '../../queries/fleet';
import { usePresenceStore } from '../../stores/presenceStore';
import { TabCount } from '../SidebarTabs';
import { Muted } from '../ui';

export function DispatcherRoster() {
  const { identity } = useSession();
  const peers = usePresenceStore(
    useShallow((state) => Object.values(state.roster).sort((a, b) => a.name.localeCompare(b.name))),
  );

  return (
    <ul className="grid gap-1.5 text-sm">
      <Row name={`${identity.name} (you)`} truckId={null} />
      {peers.map((peer) => (
        <Row key={peer.id} name={peer.name} truckId={peer.viewingTruckId} />
      ))}
      {peers.length === 0 && (
        <li>
          <Muted>No other dispatchers online.</Muted>
        </li>
      )}
    </ul>
  );
}

export function DispatcherCount() {
  return <TabCount value={usePresenceStore((state) => Object.keys(state.roster).length)} />;
}

function Row({ name, truckId }: { name: string; truckId: string | null }) {
  const truck = useTruckName(truckId ?? '');
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />
      <span className="font-medium text-slate-900">{name}</span>
      {truckId && <span className="text-slate-500">viewing {truck}</span>}
    </li>
  );
}
