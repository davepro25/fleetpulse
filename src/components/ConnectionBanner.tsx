import { CircuitOpenError, PROBE_AFTER_MS } from '../api/circuit';
import { useNow } from '../hooks/useNow';
import { useFleet } from '../queries/fleet';
import { useConnectionStore } from '../stores/connectionStore';
import { isStale, useTelemetryStore } from '../stores/telemetryStore';
import { Badge, Button } from './ui';

interface Props {
  dispatcherName: string;
  onSignOut(): void;
}

export function ConnectionBanner({ dispatcherName, onSignOut }: Props) {
  const { sse, ws, wsRttMs } = useConnectionStore();
  const lastTelemetryAt = useTelemetryStore((state) => state.lastTelemetryAt);
  const now = useNow(1_000);

  const stale = isStale(lastTelemetryAt, now);
  const secondsAgo = lastTelemetryAt === null ? 0 : Math.round((now - lastTelemetryAt) / 1000);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2.5">
      <span className="text-base font-semibold tracking-tight text-slate-900">FleetPulse</span>

      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {stale ? (
          <Badge tone="red" dot>
            Telemetry: no update for {secondsAgo}s
          </Badge>
        ) : sse === 'open' ? (
          <Badge tone="green" dot>
            Telemetry live
          </Badge>
        ) : (
          <Badge tone="amber" dot>
            Telemetry {sse}…
          </Badge>
        )}

        {ws === 'open' ? (
          <Badge tone="green" dot>
            Dispatch link{wsRttMs !== null && ` · ${wsRttMs} ms`}
          </Badge>
        ) : (
          <Badge tone="amber" dot>
            Dispatch link {ws}…
          </Badge>
        )}

        <FleetStatus />
      </div>

      <span className="ml-auto flex items-center gap-3 text-sm text-slate-600">
        <span>
          Signed in as <strong className="font-medium text-slate-900">{dispatcherName}</strong>
        </span>
        <Button onClick={onSignOut}>Sign out</Button>
      </span>
    </header>
  );
}

function FleetStatus() {
  const fleet = useFleet();

  if (fleet.error instanceof CircuitOpenError) {
    const since = fleet.dataUpdatedAt
      ? new Date(fleet.dataUpdatedAt).toLocaleTimeString()
      : 'never';
    return (
      <Badge tone="amber" dot>
        Server overloaded: truck names from {since}, retrying every {PROBE_AFTER_MS / 1000}s
      </Badge>
    );
  }
  if (!fleet.isError) return null;
  return (
    <span className="flex items-center gap-2">
      <Badge tone="red" dot>
        Truck list unavailable
      </Badge>
      <Button onClick={() => void fleet.refetch()}>Retry</Button>
    </span>
  );
}
