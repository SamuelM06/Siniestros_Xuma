import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemGasera } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemGasera[];
}

// Columnas invertidas: el nombre de cada gasera queda arriba de su columna y la
// cantidad se muestra abajo, así los nombres salen completos y sin cortar.
export default function BarChartGasera({ data }: Props) {
  return (
    <div style={{ height: 140 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 44, right: 8, left: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
          <XAxis
            dataKey="gasera"
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
          <Tooltip
            contentStyle={GLASS_TOOLTIP as React.CSSProperties}
            cursor={{ fill: 'var(--csombra-cursor)' }}
            formatter={(v) => [formatNum(Number(v)), 'Siniestros']}
            labelStyle={{ color: 'var(--qtooltip-tinta)', fontWeight: 700 }}
          />
          <Bar dataKey="total" radius={[0, 0, 6, 6]} animationDuration={1200} animationEasing="ease-out" maxBarSize={52}>
            {data.map((item, i) => (
              <Cell key={item.gasera} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
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