import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

// Gráfico de columnas (barras verticales) con el total de siniestros por aseguradora
// en el periodo filtrado; ordenado de mayor a menor para lectura rápida.
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
    <div>
      <div style={{ height: 190 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={totales} margin={{ top: 28, right: 8, left: 4, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis
              dataKey="aseguradora"
              tick={{ fill: 'var(--ctinta)', fontSize: 10.5, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={72}
            />
            <YAxis
              tickFormatter={(v: number) => formatNum(v)}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<AsegTooltip />} cursor={{ fill: 'var(--csombra-cursor)' }} />
            <Bar dataKey="total" radius={[7, 7, 0, 0]} animationDuration={1200} animationEasing="ease-out" maxBarSize={56}>
              {totales.map((item) => (
                <Cell key={item.aseguradora} fill={CHART_COLORS[totales.indexOf(item) % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-tinta/65">
        {totales.map((t, i) => (
          <span key={t.aseguradora} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            {t.aseguradora} · {t.totalFmt}
          </span>
        ))}
      </div>
    </div>
  );
}