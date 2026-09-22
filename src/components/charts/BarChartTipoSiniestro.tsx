import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ItemTipoSiniestro } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemTipoSiniestro[];
}

function TipoTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ItemTipoSiniestro }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={GLASS_TOOLTIP as React.CSSProperties}>
      <p style={{ margin: 0, fontWeight: 700 }}>{d.tipo_siniestro}</p>
      <p style={{ margin: 0 }}>Siniestros: <b>{formatNum(d.total)}</b></p>
    </div>
  );
}

// Columnas verticales: tipo en eje X (abajo), valores en eje Y (izquierda).
// Altura fija 140 igual que gasera/aseguradora para mantener la grilla sin scroll.
export default function BarChartTipoSiniestro({ data }: Props) {
  return (
    <div style={{ height: 140 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
          <XAxis
            dataKey="tipo_siniestro"
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip content={<TipoTooltip />} cursor={{ fill: 'var(--csombra-cursor)' }} />
          <Bar dataKey="total" radius={[7, 7, 0, 0]} animationDuration={1200} animationEasing="ease-out" barSize={32}>
            {data.map((item, i) => (
              <Cell key={item.tipo_siniestro} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
            ))}
            <LabelList
              dataKey="total"
              position="top"
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
