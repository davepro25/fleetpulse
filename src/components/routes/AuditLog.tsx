import { useApp } from '../../context/AppContext';
import { useTruckName } from '../../queries/fleet';
import { useAuditStore, type AuditEntry } from '../../stores/auditStore';
import { displayName } from '../../utils/identity';

export function AuditLog() {
  const entries = useAuditStore((state) => state.entries);

  return (
    <>
      <h3>Activity (since this tab opened)</h3>
      {entries.length === 0 ? (
        <p className="muted">No route changes yet.</p>
      ) : (
        <ol className="audit-log">
          {entries.map((entry) => (
            <AuditRow key={entry.key} entry={entry} />
          ))}
        </ol>
      )}
    </>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const { identity } = useApp();
  const truck = useTruckName(entry.truckId);
  const fromTruck = useTruckName(entry.previous?.truckId ?? '');
  const who = entry.actor === identity.id ? 'You' : displayName(entry.actor);

  const what = {
    assigned: `assigned ${entry.routeId} to ${truck}`,
    updated: `set ${entry.routeId} to ${entry.status}`,
    reassigned: `moved ${entry.routeId} from ${fromTruck || 'another truck'} to ${truck}`,
  }[entry.kind];

  return (
    <li>
      <span className="muted">{new Date(entry.at).toLocaleTimeString()}</span> {who} {what}
    </li>
  );
}
