import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemGasera } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemGasera[];
}

// Barras horizontales: las gaseras van en el eje Y (izquierda, nombres
// completos) y los valores en el eje X (abajo), con la cantidad al final.
export default function BarChartGasera({ data }: Props) {
  const anchoEjes = Math.min(210, 40 + Math.max(0, ...data.map((d) => d.gasera.length)) * 6.3);

  return (
    <div style={{ height: 140 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, left: 6, bottom: 4 }} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="gasera"
            tick={{ fill: 'var(--ctinta)', fontSize: 11, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            width={anchoEjes}
            interval={0}
            tickMargin={6}
          />
          <Tooltip
            contentStyle={GLASS_TOOLTIP as React.CSSProperties}
            cursor={{ fill: 'var(--csombra-cursor)' }}
            formatter={(v) => [formatNum(Number(v)), 'Siniestros']}
            labelStyle={{ color: 'var(--qtooltip-tinta)', fontWeight: 700 }}
          />
          <Bar dataKey="total" radius={[0, 7, 7, 0]} animationDuration={1200} animationEasing="ease-out" barSize={15}>
            {data.map((item, i) => (
              <Cell key={item.gasera} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
            ))}
            <LabelList
              dataKey="total"
              position="right"
              offset={6}
              formatter={(v) => formatNum(Number(v))}
              style={{ fill: 'var(--ctinta)', fontSize: 10.5, fontWeight: 800 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}