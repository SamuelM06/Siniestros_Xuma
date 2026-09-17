import { Area, CartesianGrid, ComposedChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoTendencia } from '../../lib/types';
import { formatCOP, formatCOPCompact, formatNum, mesCorto, mesLabel } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: PuntoTendencia[];
}

interface TooltipItem {
  dataKey?: string | number;
  value?: number;
}

function TendenTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.find((p) => p.dataKey === 'total')?.value ?? 0;
  const valor = payload.find((p) => p.dataKey === 'valorPagado')?.value ?? 0;
  return (
    <div style={GLASS_TOOLTIP as React.CSSProperties}>
      <p style={{ fontWeight: 700, marginBottom: 6 }}>{mesLabel(label ?? '')}</p>
      <p style={{ margin: 0 }}>Siniestros: <b>{formatNum(total)}</b></p>
      <p style={{ margin: 0 }}>Total pagado: <b>{formatCOP(valor)}</b></p>
    </div>
  );
}

const estiloEtiquetaCont = {
  fill: 'var(--ctinta)',
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "'Raleway', sans-serif",
} as const;

const estiloEtiquetaValor = {
  fill: '#00a877',
  fontSize: 9.5,
  fontWeight: 700,
  fontFamily: "'Raleway', sans-serif",
} as const;

// Tendencia mensual: área de siniestros (eje izq.) y monto pagado (eje der.),
// con los valores siempre visibles arriba de cada punto y sombreado bajo la línea.
export default function TendenciaLineChart({ data }: Props) {
  return (
    <div>
      <div style={{ height: 200 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 26, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5ae280" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#120180" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="gradAreaVal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00cd93" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#00cd93" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis
              dataKey="mes"
              tickFormatter={mesCorto}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="izq"
              tickFormatter={(v: number) => formatNum(v)}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <YAxis
              yAxisId="der"
              orientation="right"
              tickFormatter={(v: number) => formatCOPCompact(v)}
              tick={{ fill: 'var(--ctinta-dim)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<TendenTooltip />} cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }} />
            <Area
              yAxisId="izq"
              type="monotone"
              dataKey="total"
              name="Siniestros"
              stroke="#5ae280"
              strokeWidth={2.5}
              fill="url(#gradArea)"
              animationDuration={1500}
              animationEasing="ease-out"
              dot={{ r: 3, fill: '#5ae280', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: '#5ae280', stroke: '#ffffff', strokeWidth: 2 }}
            >
              <LabelList
                dataKey="total"
                position="top"
                offset={7}
                formatter={(v) => (typeof v === 'number' ? formatNum(v) : v)}
                style={estiloEtiquetaCont}
              />
            </Area>
            <Area
              yAxisId="der"
              type="monotone"
              dataKey="valorPagado"
              name="Total pagado"
              stroke="#00cd93"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              fill="url(#gradAreaVal)"
              animationDuration={1800}
              animationEasing="ease-out"
              dot={{ r: 2.5, fill: '#00cd93', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
              activeDot={{ r: 5.5, fill: '#00cd93', stroke: '#ffffff', strokeWidth: 2 }}
            >
              <LabelList
                dataKey="valorPagado"
                position="top"
                offset={7}
                formatter={(v) => (typeof v === 'number' ? formatCOPCompact(v) : v)}
                style={estiloEtiquetaValor}
              />
            </Area>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-tinta/70">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: '#5ae280' }} />
          Siniestros
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: '#00cd93' }} />
          Total pagado (COP)
        </span>
      </div>
    </div>
  );
}
