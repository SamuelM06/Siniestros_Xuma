import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SerieAseguradora } from '../../lib/types';
import { formatNum, mesCorto, mesLabel } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: SerieAseguradora[];
}

function AsiTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={GLASS_TOOLTIP as React.CSSProperties}>
      <p style={{ marginBottom: 6, fontWeight: 700 }}>{mesLabel(label ?? '')}</p>
      {[...payload]
        .filter((p) => p.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <p key={p.name} style={{ margin: 0 }}>
            <span
              style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, marginRight: 6, background: p.color }}
            />
            {p.name}: <b>{formatNum(p.value)}</b>
          </p>
        ))}
    </div>
  );
}

// Barras apiladas: siniestros por mes desglosados por aseguradora.
export default function BarChartAseguradora({ data }: Props) {
  const aseguradoras = data.length > 0 ? Object.keys(data[0]!.porAseguradora) : [];
  const totalMes = (m: SerieAseguradora) =>
    Object.values(m.porAseguradora).reduce((a, b) => a + b, 0);

  return (
    <div style={{ height: 300 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tickFormatter={mesCorto}
            tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<AsiTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          {aseguradoras.map((aseguradora, i) => (
            <Bar
              key={aseguradora}
              dataKey={aseguradora}
              stackId="s"
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={
                i === aseguradoras.length - 1 ? [8, 8, 0, 0] : undefined
              }
              animationDuration={1100 + i * 120}
              animationEasing="ease-out"
              maxBarSize={46}
            />
          ))}
          <Bar
            dataKey={(m: SerieAseguradora) => totalMes(m)}
            name="Total"
            fill="transparent"
            stackId="s"
            tooltipType="none"
          />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {aseguradoras.map((a, i) => (
          <span key={a} className="flex items-center gap-1.5 text-xs text-white/70">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}