import { useSession } from '../../context/SessionContext';
import { useTruckName } from '../../queries/fleet';
import { useAuditStore, type AuditEntry } from '../../stores/auditStore';
import { displayName } from '../../utils/identity';
import { Muted } from '../ui';
import { TabCount } from '../SidebarTabs';

export function AuditLog() {
  const entries = useAuditStore((state) => state.entries);

  return (
    <>
      {entries.length === 0 ? (
        <Muted>No route changes since this tab opened.</Muted>
      ) : (
        <ol className="grid gap-1.5 text-sm">
          {entries.map((entry) => (
            <AuditRow key={entry.key} entry={entry} />
          ))}
        </ol>
      )}
    </>
  );
}

export function ActivityCount() {
  return <TabCount value={useAuditStore((state) => state.entries.length)} />;
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const { identity } = useSession();
  const truck = useTruckName(entry.truckId);
  const fromTruck = useTruckName(entry.previous?.truckId ?? '');
  const who = entry.actor === identity.id ? 'You' : displayName(entry.actor);

  const what = {
    assigned: `assigned ${entry.routeId} to ${truck}`,
    updated: `set ${entry.routeId} to ${entry.status}`,
    reassigned: `moved ${entry.routeId} from ${fromTruck || 'another truck'} to ${truck}`,
  }[entry.kind];

  return (
    <li className="flex gap-2">
      <time className="shrink-0 text-xs tabular-nums leading-5 text-slate-500">
        {new Date(entry.at).toLocaleTimeString()}
      </time>
      <span className="text-slate-700">
        <strong className="font-medium text-slate-900">{who}</strong> {what}
      </span>
    </li>
  );
}
