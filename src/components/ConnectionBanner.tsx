import { useQuery } from '@tanstack/react-query';
import { useNow } from '../hooks/useNow';
import { fleetQueryOptions } from '../queries/fleet';
import { useConnectionStore } from '../stores/connectionStore';
import { isStale, useTelemetryStore } from '../stores/telemetryStore';

export function ConnectionBanner({ dispatcherName }: { dispatcherName: string }) {
  const { sse, ws, wsRttMs } = useConnectionStore();
  const lastTelemetryAt = useTelemetryStore((state) => state.lastTelemetryAt);
  const fleet = useQuery(fleetQueryOptions);
  const now = useNow(1_000);

  const stale = isStale(lastTelemetryAt, now);
  const secondsAgo = lastTelemetryAt === null ? 0 : Math.round((now - lastTelemetryAt) / 1000);

  return (
    <header className="banner">
      <strong>FleetPulse</strong>
      <span>{dispatcherName}</span>

      <span className={sse === 'open' && !stale ? 'ok' : 'warn'}>
        Live data: {stale ? `no update for ${secondsAgo}s` : sse}
      </span>

      <span className={ws === 'open' ? 'ok' : 'warn'}>
        Dispatch link: {ws}
        {ws === 'open' && wsRttMs !== null && ` (${wsRttMs} ms)`}
      </span>

      {fleet.isError && (
        <span className="warn">
          Truck list unavailable <button onClick={() => void fleet.refetch()}>Retry</button>
        </span>
      )}
    </header>
  );
}
