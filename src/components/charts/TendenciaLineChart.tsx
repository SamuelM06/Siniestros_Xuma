import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoTendencia } from '../../lib/types';
import { formatCOP, formatCOPCompact, formatNum, mesCorto, mesLabel } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: PuntoTendencia[];
}

function TendenTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload[0]?.value ?? 0;
  const valor = payload.length > 1 ? payload[1]?.value ?? 0 : 0;
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
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "'Raleway', sans-serif",
} as const;

const estiloEtiquetaValor = {
  fill: 'var(--ctinta-dim)',
  fontSize: 10,
  fontWeight: 600,
  fontFamily: "'Raleway', sans-serif",
} as const;

// Tendencia mensual: área con degradado de marca + puntos y valores siempre visibles.
export default function TendenciaLineChart({ data }: Props) {
  return (
    <div style={{ height: 320 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5ae280" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#120180" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
          <XAxis
            dataKey="mes"
            tickFormatter={mesCorto}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatNum(v)}
            tick={{ fill: 'var(--ctinta-suave)', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip content={<TendenTooltip />} cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="total"
            name="Siniestros"
            stroke="#5ae280"
            strokeWidth={3}
            fill="url(#gradArea)"
            animationDuration={1500}
            animationEasing="ease-out"
            dot={{ r: 4, fill: '#5ae280', stroke: 'var(--qtooltip-fondo)', strokeWidth: 2 }}
            activeDot={{ r: 7, fill: '#5ae280', stroke: '#ffffff', strokeWidth: 2 }}
          >
            <LabelList
              dataKey="total"
              position="top"
              offset={8}
              formatter={(v) => (typeof v === 'number' ? formatNum(v) : v)}
              style={estiloEtiquetaCont}
            />
          </Area>
          <Area
            type="monotone"
            dataKey="valorPagado"
            name="Total pagado"
            stroke="#00cd93"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            animationDuration={1800}
            animationEasing="ease-out"
            dot={{ r: 3, fill: '#00cd93', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
            activeDot={{ r: 6, fill: '#00cd93', stroke: '#ffffff', strokeWidth: 2 }}
          >
            <LabelList
              dataKey="valorPagado"
              position="bottom"
              offset={6}
              formatter={(v) => (typeof v === 'number' ? formatCOPCompact(v) : v)}
              style={estiloEtiquetaValor}
            />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}