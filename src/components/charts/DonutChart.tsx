import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ItemProducto } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, GLASS_TOOLTIP } from './palette';

interface Props {
  data: ItemProducto[];
}

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; percent: number }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  if (!p) return null;
  const pct = Math.round(p.percent * 1000) / 10;
  return (
    <div style={GLASS_TOOLTIP as React.CSSProperties}>
      <p style={{ margin: 0, fontWeight: 700 }}>{p.name}</p>
      <p style={{ margin: 0 }}>{formatNum(p.value)} · {pct}%</p>
    </div>
  );
}

// Dona con animación de giro/crecimiento para la participación por producto.
export default function DonutChart({ data }: Props) {
  const total = data.reduce((a, b) => a + b.total, 0);
  return (
    <div>
      <div style={{ height: 260 }} className="relative w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="producto"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={3}
              cornerRadius={7}
              stroke="none"
              animationDuration={1300}
              animationEasing="ease-out"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length] ?? '#5ae280'} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-white tabular">{formatNum(total)}</span>
          <span className="text-[11px] text-white/55">siniestros</span>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {data.map((item, i) => (
          <li key={item.producto} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate text-white/75">{item.producto}</span>
            </span>
            <span className="font-semibold text-white/90 tabular">
              {formatNum(item.total)}
              <span className="ml-1.5 text-white/45">
                {total > 0 ? `${Math.round((item.total / total) * 1000) / 10}%` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}