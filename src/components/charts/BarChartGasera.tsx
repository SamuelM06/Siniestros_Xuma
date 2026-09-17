import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemGasera } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemGasera[];
}

const LIMIT = 13;

function trimNombre(v: string): string {
  return v.length > LIMIT ? `${v.slice(0, LIMIT - 1)}…` : v;
}

// Barras horizontales: cantidad de siniestros por gasera (top N + Otros).
export default function BarChartGasera({ data }: Props) {
  return (
    <div style={{ height: 320 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 18, left: 6, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.08)" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="gasera"
            tickFormatter={trimNombre}
            tick={{ fill: 'rgba(255,255,255,0.72)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={GLASS_TOOLTIP as React.CSSProperties}
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            formatter={(v) => [formatNum(Number(v)), 'Siniestros']}
            labelStyle={{ color: '#eef1fb', fontWeight: 700 }}
          />
          <defs>
            <linearGradient id="gradGasera" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#120180" />
              <stop offset="100%" stopColor="#00cd93" />
            </linearGradient>
          </defs>
          <Bar dataKey="total" radius={[0, 9, 9, 0]} animationDuration={1200} animationEasing="ease-out" barSize={20}>
            {data.map((item, i) => (
              <Cell key={item.gasera} fill={CHART_COLORS[i % (CHART_COLORS.length - 2)] ?? '#5ae280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}