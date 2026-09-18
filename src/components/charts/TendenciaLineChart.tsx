import { Area, AreaChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoTendencia } from '../../lib/types';
import { formatCOP, formatCOPCompact, formatNum, mesCorto, mesLabel } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: PuntoTendencia[];
}

const estiloEtiqueta = {
  fill: 'var(--ctinta)',
  fontSize: 9.5,
  fontWeight: 700,
  fontFamily: "'Raleway', sans-serif",
} as const;

// Tendencia mensual en dos paneles apilados (siniestros arriba, montos abajo)
// con el mismo eje X: las dos series nunca se cruzan y siempre se entienden.
export default function TendenciaLineChart({ data }: Props) {
  return (
    <div>
      <div className="flex h-40 flex-col gap-2">
        {/* Siniestros por mes */}
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAreaTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cgraf-1)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--cgraf-1)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
              <XAxis
                dataKey="mes"
                hide
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                tickFormatter={(v: number) => formatNum(v)}
                tick={{ fill: 'var(--ctinta-suave)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={38}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div style={GLASS_TOOLTIP as React.CSSProperties}>
                      <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{mesLabel(String(label ?? ''))}</p>
                      <p style={{ margin: 0 }}>Siniestros: <b>{formatNum(Number(payload[0]?.value ?? 0))}</b></p>
                    </div>
                  );
                }}
                cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Siniestros"
                stroke="var(--cgraf-1)"
                strokeWidth={2.5}
                fill="url(#gradAreaTotal)"
                animationDuration={1500}
                animationEasing="ease-out"
                dot={{ r: 3.5, fill: 'var(--cgraf-1)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: 'var(--cgraf-1)', stroke: '#ffffff', strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={3}
                  formatter={(v) => (typeof v === 'number' ? formatNum(v) : v)}
                  style={estiloEtiqueta}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Total pagado por mes */}
        <div className="min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAreaValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--cgraf-2)" stopOpacity={0.38} />
                  <stop offset="100%" stopColor="var(--cgraf-2)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
              <XAxis
                dataKey="mes"
                tickFormatter={mesCorto}
                tick={{ fill: 'var(--ctinta-suave)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                padding={{ left: 8, right: 8 }}
              />
              <YAxis
                orientation="right"
                tickFormatter={(v: number) => formatCOPCompact(v)}
                tick={{ fill: 'var(--ctinta-dim)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={54}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div style={GLASS_TOOLTIP as React.CSSProperties}>
                      <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{mesLabel(String(label ?? ''))}</p>
                      <p style={{ margin: 0 }}>Total pagado: <b>{formatCOP(Number(payload[0]?.value ?? 0))}</b></p>
                    </div>
                  );
                }}
                cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="valorPagado"
                name="Total pagado"
                stroke="var(--cgraf-2)"
                strokeWidth={2.5}
                fill="url(#gradAreaValor)"
                animationDuration={1500}
                animationEasing="ease-out"
                dot={{ r: 3.5, fill: 'var(--cgraf-2)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: 'var(--cgraf-2)', stroke: '#ffffff', strokeWidth: 2 }}
              >
                <LabelList
                  dataKey="valorPagado"
                  position="top"
                  offset={3}
                  formatter={(v) => (typeof v === 'number' ? formatCOPCompact(v) : v)}
                  style={estiloEtiqueta}
                />
              </Area>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/70">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-1)' }} />
          Siniestros
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-2)' }} />
          Total pagado (COP)
        </span>
      </div>
    </div>
  );
}