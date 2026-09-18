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

// Columnas invertidas: el nombre de cada aseguradora queda arriba de su columna
// y la cantidad se muestra abajo, así los nombres nunca se cortan.
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
        <BarChart data={totales} margin={{ top: 44, right: 8, left: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
          <XAxis
            dataKey="aseguradora"
            type="category"
            orientation="top"
            tick={{ fill: 'var(--ctinta)', fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            height={44}
            tickMargin={6}
          />
          <YAxis reversed domain={[0, (d: number) => Math.ceil(d * 1.15)]} hide />
          <Tooltip content={<AsegTooltip />} cursor={{ fill: 'var(--csombra-cursor)' }} />
          <Bar dataKey="total" radius={[0, 0, 6, 6]} animationDuration={1200} animationEasing="ease-out" maxBarSize={52}>
            {totales.map((item) => (
              <Cell key={item.aseguradora} fill={CHART_COLORS[totales.indexOf(item) % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
            ))}
            <LabelList
              dataKey="total"
              position="insideBottom"
              offset={6}
              formatter={(v) => formatNum(Number(v))}
              style={{ fill: '#ffffff', fontSize: 10.5, fontWeight: 800 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}