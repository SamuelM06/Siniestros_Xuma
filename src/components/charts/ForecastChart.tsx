import { Bar, CartesianGrid, ComposedChart, ErrorBar, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoForecast } from '../../lib/types';
import { formatCOP, formatCOPCompact, formatNum } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: PuntoForecast[];
  anioObjetivo: number;
  anioPrevio: number;
}

interface Fila {
  label: string;
  sin: number;
  sinRango: [number, number];
  monto: number;
  montoRango: [number, number];
  ref: number;
}

// Píldora casi sólida del color del panel sobre cada barra pronosticada:
// el número se lee aunque los bigotes o la línea pasen por detrás.
function EtiquetaPildora(props: { x?: number | string; y?: number | string; value?: number | string }) {
  const cx = Number(props.x);
  const cy = Number(props.y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const texto = typeof props.value === 'number' ? formatNum(props.value) : String(props.value ?? '');
  if (!texto) return null;
  const alto = 19;
  const ancho = texto.length * 6.6 + 12;
  const py = cy - 12;
  return (
    <g>
      <rect
        x={cx - ancho / 2}
        y={py - alto / 2}
        width={ancho}
        height={alto}
        rx={alto / 2}
        fill="var(--cpanel-fondo)"
        fillOpacity={0.95}
        stroke="var(--cglass-borde)"
        strokeOpacity={0.8}
      />
      <text
        x={cx}
        y={py + 0.5}
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--ctinta)"
        fontSize={10.5}
        fontWeight={800}
        fontFamily="'Raleway', sans-serif"
      >
        {texto}
      </text>
    </g>
  );
}

// Pronóstico anual: barras = siniestros previstos (bigotes = intervalo 80%),
// línea = dinero pagado previsto, línea punteada = real del año previo.
export default function ForecastChart({ data, anioObjetivo, anioPrevio }: Props) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-tinta/55">Sin datos para el rango seleccionado.</p>;
  }
  const filas: Fila[] = data.map((p) => ({
    label: p.label,
    sin: p.siniestros,
    sinRango: [p.sinLow, p.sinHigh],
    monto: p.monto,
    montoRango: [p.montoLow, p.montoHigh],
    ref: p.refAnioPrevio,
  }));

  return (
    <div>
      <div className="h-[320px] w-full xl:h-[270px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filas} margin={{ top: 24, right: 8, left: 4, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              yAxisId="si"
              tickFormatter={(v: number) => formatNum(v)}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <YAxis
              yAxisId="dinero"
              orientation="right"
              tickFormatter={(v: number) => (v === 0 ? '0' : formatCOPCompact(v))}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const fila = filas.find((f) => f.label === String(label ?? ''));
                return (
                  <div style={GLASS_TOOLTIP as React.CSSProperties}>
                    <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>
                      {String(label ?? '')} {anioObjetivo}
                    </p>
                    {fila && (
                      <>
                        <p style={{ margin: 0 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--cgraf-1)', marginRight: 6 }} />
                          Siniestros: <b>{formatNum(fila.sin)}</b>
                          <span style={{ opacity: 0.7 }}> (80%: {formatNum(fila.sinRango[0])}–{formatNum(fila.sinRango[1])})</span>
                        </p>
                        <p style={{ margin: 0 }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--cgraf-2)', marginRight: 6 }} />
                          Pagado: <b>{formatCOP(fila.monto)}</b>
                          <span style={{ opacity: 0.7 }}> (80%: {formatCOPCompact(fila.montoRango[0])}–{formatCOPCompact(fila.montoRango[1])})</span>
                        </p>
                        <p style={{ margin: 0, opacity: 0.75 }}>
                          Real {anioPrevio}: <b>{formatNum(fila.ref)}</b>
                        </p>
                      </>
                    )}
                  </div>
                );
              }}
              cursor={{ fill: 'var(--csombra-cursor)' }}
            />
            <Bar
              yAxisId="si"
              dataKey="sin"
              name={`Siniestros ${anioObjetivo}`}
              fill="var(--cgraf-1)"
              radius={[4, 4, 0, 0]}
              barSize={26}
              animationDuration={1200}
              animationEasing="ease-out"
            >
              <LabelList dataKey="sin" position="top" offset={10} content={<EtiquetaPildora />} />
              <ErrorBar dataKey="sinRango" width={6} strokeWidth={1.5} stroke="var(--cgraf-1)" />
            </Bar>
            <Line
              yAxisId="si"
              type="monotone"
              dataKey="ref"
              name={`Real ${anioPrevio}`}
              stroke="var(--ctinta-suave)"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4 }}
              animationDuration={1400}
            />
            <Line
              yAxisId="dinero"
              type="monotone"
              dataKey="monto"
              name={`Pagado ${anioObjetivo}`}
              stroke="var(--cgraf-2)"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'var(--cgraf-2)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: 'var(--cgraf-2)', stroke: '#ffffff', strokeWidth: 2 }}
              animationDuration={1400}
              animationEasing="ease-out"
            >
              <ErrorBar dataKey="montoRango" width={4} strokeWidth={1} stroke="var(--cgraf-2)" />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/70">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-sm" style={{ background: 'var(--cgraf-1)' }} />
          Siniestros {anioObjetivo} (bigotes = intervalo 80%)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-2)' }} />
          Pagado {anioObjetivo} (COP)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--ctinta-suave)' }} />
          Real {anioPrevio}
        </span>
      </div>
    </div>
  );
}
