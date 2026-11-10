import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Sample } from '../../domain/telemetry/pipeline';

const SERIES = [
  { key: 'speed', label: 'Speed', unit: 'km/h', color: '#4f46e5', domain: [0, 'auto'] },
  { key: 'fuel', label: 'Fuel', unit: '%', color: '#059669', domain: [0, 100] },
  {
    key: 'engineTemp',
    label: 'Engine temp',
    unit: '°C',
    color: '#d97706',
    domain: ['auto', 'auto'],
  },
] as const;

const time = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

// Animations off: a new point every 2 s would restart them forever.
// connectNulls off: a faulted reading is stored as null and shows as a gap, never as a spike.
export function TelemetryCharts({ samples }: { samples: Sample[] }) {
  return (
    <div className="grid gap-3">
      {SERIES.map(({ key, label, unit, color, domain }) => (
        <figure key={key} className="grid gap-1">
          <figcaption className="text-xs font-medium text-slate-600">
            {label} ({unit})
          </figcaption>
          <div className="h-24">
            <ResponsiveContainer>
              <LineChart data={samples} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={time}
                  tick={{ fontSize: 10 }}
                  minTickGap={40}
                />
                <YAxis domain={[...domain]} tick={{ fontSize: 10 }} width={48} />
                <Tooltip
                  labelFormatter={(value) => time(Number(value))}
                  formatter={(value) => [`${Math.round(Number(value))} ${unit}`, label]}
                />
                <Line
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
      ))}
    </div>
  );
}
