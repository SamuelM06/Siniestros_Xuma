import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemGasera } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemGasera[];
}

// Columnas verticales: cantidad de siniestros por gasera con los nombres
// horizontales abajo; las cantidades van completas (etiqueta sobre la barra
// y eje izquierdo) para que nunca se corten.
export default function BarChartGasera({ data }: Props) {
  return (
    <div style={{ height: 140 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: 4, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
          <XAxis
            dataKey="gasera"
            tick={{ fill: 'var(--ctinta)', fontSize: 10.5, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            interval={0}
            height={40}
            tickMargin={4}
          />
          <YAxis
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip
            contentStyle={GLASS_TOOLTIP as React.CSSProperties}
            cursor={{ fill: 'var(--csombra-cursor)' }}
            formatter={(v) => [formatNum(Number(v)), 'Siniestros']}
            labelStyle={{ color: 'var(--qtooltip-tinta)', fontWeight: 700 }}
          />
          <Bar dataKey="total" radius={[6, 6, 2, 2]} animationDuration={1200} animationEasing="ease-out" maxBarSize={52}>
            {data.map((item, i) => (
              <Cell key={item.gasera} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
            ))}
            <LabelList
              dataKey="total"
              position="top"
              offset={5}
              formatter={(v) => formatNum(Number(v))}
              style={{ fill: 'var(--ctinta)', fontSize: 10, fontWeight: 800 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}