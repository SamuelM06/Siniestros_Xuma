import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemGasera } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemGasera[];
}

// Barras horizontales: cantidad de siniestros por gasera (nombres completos).
export default function BarChartGasera({ data }: Props) {
  const anchoEjes = Math.min(230, 40 + Math.max(0, ...data.map((d) => d.gasera.length)) * 6.5);

  return (
    <div style={{ height: 140 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 6, bottom: 0 }} barCategoryGap="24%">
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
            tick={{ fill: 'var(--ctinta)', fontSize: 10.5, fontWeight: 600 }}
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
          <defs>
            <linearGradient id="gradGasera" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#120180" />
              <stop offset="100%" stopColor="#00cd93" />
            </linearGradient>
          </defs>
          <Bar dataKey="total" radius={[0, 7, 7, 0]} animationDuration={1200} animationEasing="ease-out" barSize={13}>
            {data.map((item, i) => (
              <Cell key={item.gasera} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}