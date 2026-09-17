import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SerieAseguradora } from '../../lib/types';
import { formatNum, mesCorto, mesLabel } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: SerieAseguradora[];
}

function AsiTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const ver = [...payload].filter((p) => p.value > 0 && p.name !== 'Total');
  const total = payload.find((p) => p.name === 'Total')?.value ?? ver.reduce((a, b) => a + b.value, 0);
  return (
    <div style={GLASS_TOOLTIP as React.CSSProperties}>
      <p style={{ marginBottom: 6, fontWeight: 700 }}>{mesLabel(label ?? '')}</p>
      {[...ver]
        .sort((a, b) => b.value - a.value)
        .map((p) => (
          <p key={p.name} style={{ margin: 0 }}>
            <span
              style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, marginRight: 6, background: p.color }}
            />
            {p.name}: <b>{formatNum(p.value)}</b>
          </p>
        ))}
      <p style={{ margin: 0, borderTop: '1px solid var(--qtooltip-borde)', paddingTop: 6, marginTop: 6 }}>
        Total: <b>{formatNum(total)}</b>
      </p>
    </div>
  );
}

// Barras apiladas por aseguradora + línea de total con valores visibles.
export default function BarChartAseguradora({ data }: Props) {
  const aseguradoras = data.length > 0 ? Object.keys(data[0]!.porAseguradora) : [];
  const conTotal = data.map((m) => ({
    ...m,
    total: Object.values(m.porAseguradora).reduce((a, b) => a + b, 0),
  }));

  return (
    <div style={{ height: 200 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={conTotal} margin={{ top: 22, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
          <XAxis
            dataKey="label"
            tickFormatter={mesCorto}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<AsiTooltip />} cursor={{ fill: 'var(--csombra-cursor)' }} />
          {aseguradoras.map((aseguradora, i) => (
            <Bar
              key={aseguradora}
              dataKey={aseguradora}
              stackId="s"
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={i === aseguradoras.length - 1 ? [6, 6, 0, 0] : undefined}
              animationDuration={1100 + i * 120}
              animationEasing="ease-out"
              maxBarSize={42}
            />
          ))}
          <Line
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#5ae280"
            strokeWidth={2.5}
            strokeLinecap="round"
            dot={{ r: 4, fill: '#5ae280', stroke: 'var(--qtooltip-fondo)', strokeWidth: 2 }}
            activeDot={{ r: 7, fill: '#5ae280', stroke: '#ffffff', strokeWidth: 2 }}
            animationDuration={1500}
            animationEasing="ease-out"
          >
            <LabelList
              dataKey="total"
              position="top"
              offset={8}
              formatter={(v) => (typeof v === 'number' ? formatNum(v) : v)}
              style={{ fill: 'var(--ctinta)', fontSize: 10.5, fontWeight: 700, fontFamily: "'Raleway', sans-serif" }}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {aseguradoras.map((a, i) => (
          <span key={a} className="flex items-center gap-1.5 text-[11px] text-tinta/70">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            {a}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-tinta/80">
          <span className="h-0.5 w-4 rounded-full" style={{ background: '#5ae280' }} />
          Total
        </span>
      </div>
    </div>
  );
}