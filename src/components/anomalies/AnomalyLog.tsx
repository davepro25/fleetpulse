import type { SensorAnomaly } from '../../domain/telemetry/anomalies';
import { useTruckName } from '../../queries/fleet';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { TabCount } from '../SidebarTabs';
import { Badge, Muted, type Tone } from '../ui';

const OUTCOME: Record<SensorAnomaly['outcome'], { label: string; tone: Tone }> = {
  ongoing: { label: 'Ongoing', tone: 'amber' },
  sensor_glitch: { label: 'Sensor glitch', tone: 'neutral' },
  confirmed: { label: 'Real fuel drop', tone: 'red' },
};

const UNIT = { speed: 'km/h', fuel: '%' } as const;

export function AnomalyLog({ onSelect }: { onSelect(truckId: string): void }) {
  const anomalies = useTelemetryStore((state) => state.anomalies);

  if (anomalies.length === 0) {
    return <Muted>No sensor faults since this tab opened.</Muted>;
  }
  return (
    <div className="grid gap-4">
      <p className="text-sm text-slate-600">
        A <strong className="font-medium">sensor glitch</strong> fixed itself: the sensor was wrong,
        the truck is fine. A <strong className="font-medium">real fuel drop</strong> held for 10 s:
        check the truck.
      </p>
      <Summary anomalies={anomalies} onSelect={onSelect} />
      <ol className="grid gap-2 text-sm">
        {anomalies.map((anomaly) => (
          <AnomalyRow key={anomaly.id} anomaly={anomaly} onSelect={onSelect} />
        ))}
      </ol>
    </div>
  );
}

export function AnomalyCount() {
  return <TabCount value={useTelemetryStore((state) => state.anomalies.length)} />;
}

/** Per truck: a truck with many glitches needs a sensor check, one with a confirmed drop needs a driver call. */
function Summary({
  anomalies,
  onSelect,
}: {
  anomalies: SensorAnomaly[];
  onSelect(truckId: string): void;
}) {
  // Map.groupBy would be shorter, but it is ES2024 and the tests still run on Node 20.
  const perTruck = new Map<string, Record<SensorAnomaly['outcome'], number>>();
  for (const { truckId, outcome } of anomalies) {
    const counts = perTruck.get(truckId) ?? { ongoing: 0, sensor_glitch: 0, confirmed: 0 };
    counts[outcome] += 1;
    perTruck.set(truckId, counts);
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
          <th className="py-1 font-semibold">Truck</th>
          <th className="py-1 font-semibold">Glitches</th>
          <th className="py-1 font-semibold">Real drops</th>
          <th className="py-1 font-semibold">Ongoing</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 tabular-nums">
        {[...perTruck].map(([truckId, counts]) => (
          <tr key={truckId}>
            <td className="py-1">
              <TruckLink id={truckId} onSelect={onSelect} />
            </td>
            <td className="py-1">{counts.sensor_glitch}</td>
            <td className="py-1">{counts.confirmed}</td>
            <td className="py-1">{counts.ongoing}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AnomalyRow({
  anomaly,
  onSelect,
}: {
  anomaly: SensorAnomaly;
  onSelect(truckId: string): void;
}) {
  const { sensor, raw, lastGood, since, until, outcome } = anomaly;
  const unit = UNIT[sensor];
  const shown = lastGood === null ? 'nothing' : `${Math.round(lastGood)} ${unit}`;
  const duration = until === null ? 'still going' : `${Math.round((until - since) / 1000)} s`;

  return (
    <li className="grid gap-0.5 rounded-md border border-slate-200 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <time className="text-xs tabular-nums text-slate-500">
          {new Date(since).toLocaleTimeString()} · {duration}
        </time>
        <TruckLink id={anomaly.truckId} onSelect={onSelect} />
        <Badge tone={OUTCOME[outcome].tone}>{OUTCOME[outcome].label}</Badge>
      </div>
      <p className="text-slate-700">
        {/* Once confirmed, the low value is what the app shows, so "showing ... instead" is no longer true. */}
        {outcome === 'confirmed'
          ? `Fuel dropped from ${shown} to ${Math.round(raw)} ${unit}.`
          : `${sensor === 'speed' ? 'Speed' : 'Fuel'} read ${Math.round(raw)} ${unit}; showing ${shown} instead.`}
      </p>
    </li>
  );
}

function TruckLink({ id, onSelect }: { id: string; onSelect(truckId: string): void }) {
  return (
    <button
      className="cursor-pointer rounded font-medium text-slate-900 hover:text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-600"
      onClick={() => onSelect(id)}
    >
      {useTruckName(id)}
    </button>
  );
}
