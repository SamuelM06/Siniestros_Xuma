import { Area, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AnioHist } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: AnioHist[];
}

const estiloEtiqueta = {
  fill: 'var(--ctinta)',
  fontSize: 11,
  fontWeight: 800,
  fontFamily: "'Raleway', sans-serif",
} as const;

// Tendencia histórica: área de casos por año (eje izquierdo) + línea de
// % pagado (eje derecho, 0–100). Rango fijo 2018–2026 con la línea de años.
export default function TendenciaAnualChart({ data }: Props) {
  return (
    <div>
      <div style={{ height: 260 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 24, right: 8, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAreaHist" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--cgraf-1)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--cgraf-1)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis
              dataKey="anio"
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              yAxisId="casos"
              tickFormatter={(v: number) => formatNum(v)}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0]?.payload as AnioHist | undefined;
                return (
                  <div style={GLASS_TOOLTIP as React.CSSProperties}>
                    <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>
                      {String(label ?? '')}
                      {Number(label) === 2026 ? ' (parcial)' : ''}
                    </p>
                    <p style={{ margin: 0 }}>Casos: <b>{formatNum(d?.total ?? 0)}</b></p>
                    <p style={{ margin: 0 }}>% pagado: <b>{d?.porcPagado ?? 0}%</b></p>
                  </div>
                );
              }}
              cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }}
            />
            <Area
              yAxisId="casos"
              type="monotone"
              dataKey="total"
              name="Casos"
              stroke="var(--cgraf-1)"
              strokeWidth={2.5}
              fill="url(#gradAreaHist)"
              animationDuration={1500}
              animationEasing="ease-out"
              dot={{ r: 3.5, fill: 'var(--cgraf-1)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: 'var(--cgraf-1)', stroke: '#ffffff', strokeWidth: 2 }}
            >
              <LabelList
                dataKey="total"
                position="top"
                offset={8}
                formatter={(v) => (typeof v === 'number' ? formatNum(v) : v)}
                style={estiloEtiqueta}
              />
            </Area>
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="porcPagado"
              name="% pagado"
              stroke="var(--cgraf-3)"
              strokeWidth={2.5}
              dot={{ r: 3.5, fill: 'var(--cgraf-3)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: 'var(--cgraf-3)', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/70">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-1)' }} />
          Casos por año
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-3)' }} />
          % pagado (eje derecho)
        </span>
        <span className="text-tinta/45">2026 parcial (hasta septiembre)</span>
      </div>
    </div>
  );
}
