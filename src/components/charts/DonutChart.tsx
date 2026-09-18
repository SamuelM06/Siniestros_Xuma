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
      <div style={{ height: 110 }} className="relative w-full">
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
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length] ?? 'var(--cgraf-1)'} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-lg font-extrabold text-tinta">{formatNum(total)}</span>
          <span className="text-[9px] text-tinta/55">siniestros</span>
        </div>
      </div>
      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0">
        {data.map((item, i) => (
          <li key={item.producto} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="truncate text-tinta/75">{item.producto}</span>
            </span>
            <span className="tabular font-semibold text-tinta/90">
              {formatNum(item.total)}
              <span className="ml-1.5 text-tinta/45">
                {total > 0 ? `${Math.round((item.total / total) * 1000) / 10}%` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}