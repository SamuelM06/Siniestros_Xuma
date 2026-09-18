import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SerieAseguradora } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: SerieAseguradora[];
}

interface Total {
  aseguradora: string;
  total: number;
  totalFmt: string;
  pct: number;
}

function AsegTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Total }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={GLASS_TOOLTIP as React.CSSProperties}>
      <p style={{ margin: 0, fontWeight: 700 }}>{d.aseguradora}</p>
      <p style={{ margin: 0 }}>Total: <b>{d.totalFmt}</b> ({d.pct}%)</p>
    </div>
  );
}

// Gráfico de columnas con el total de siniestros por aseguradora en el periodo
// filtrado, ordenado de mayor a menor; los nombres quedan horizontales abajo.
export default function BarChartAseguradora({ data }: Props) {
  const aseguradoras = data.length > 0 ? Object.keys(data[0]!.porAseguradora) : [];

  const totalPorAseg = aseguradoras
    .map((a) => ({ aseguradora: a, total: data.reduce((s, m) => s + (m.porAseguradora[a] ?? 0), 0) }))
    .filter((t) => t.total > 0)
    .sort((x, y) => y.total - x.total);

  const granTotal = totalPorAseg.reduce((s, t) => s + t.total, 0);
  const totales: Total[] = totalPorAseg.map((t) => ({
    ...t,
    totalFmt: formatNum(t.total),
    pct: granTotal > 0 ? Math.round((t.total / granTotal) * 1000) / 10 : 0,
  }));

  return (
    <div style={{ height: 140 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={totales} margin={{ top: 18, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
          <XAxis
            dataKey="aseguradora"
            tick={{ fill: 'var(--ctinta)', fontSize: 10.5, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            height={38}
            tickMargin={4}
          />
          <YAxis
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip content={<AsegTooltip />} cursor={{ fill: 'var(--csombra-cursor)' }} />
          <Bar dataKey="total" radius={[6, 6, 2, 2]} animationDuration={1200} animationEasing="ease-out" maxBarSize={56}>
            {totales.map((item) => (
              <Cell key={item.aseguradora} fill={CHART_COLORS[totales.indexOf(item) % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
            ))}
            <LabelList
              dataKey="pct"
              position="top"
              offset={5}
              formatter={(v) => `${v}%`}
              style={{ fill: 'var(--ctinta)', fontSize: 10, fontWeight: 800 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}