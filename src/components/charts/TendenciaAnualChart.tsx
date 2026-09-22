import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SerieMensualAnio } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, COLOR_OTROS, GLASS_TOOLTIP } from './palette';

interface Props {
  series: SerieMensualAnio[];
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
// Separación vertical mínima entre etiquetas de año (px) y alto aproximado
// del área de trazado, para convertir esa separación a unidades de datos.
const GAP_ETIQUETA_PX = 18;
const ALTO_TRAZADO_PX = 360;

// Comparativa interanual: meses en el eje X y una línea por cada año.
// - El año en curso se corta en el último mes con dato (null = sin dato).
// - Las etiquetas de año se separan entre sí (anti-colisión) y llevan halo.
// - El año parcial se destaca: línea gruesa encima + punto pulsante animado.
export default function TendenciaAnualChart({ series }: Props) {
  const [resaltado, setResaltado] = useState<number | null>(null);

  const ordenadas = useMemo(
    () => [...series].sort((a, b) => a.anio - b.anio),
    [series],
  );

  const yMax = useMemo(() => {
    let m = 0;
    for (const s of ordenadas) {
      for (const v of s.meses) {
        if (v !== null && v > m) m = v;
      }
    }
    return m || 1;
  }, [ordenadas]);

  const lineas = useMemo(() => {
    const base = [...CHART_COLORS, COLOR_OTROS];
    return ordenadas.map((s, i) => {
      const meses = s.meses.map((v) => v ?? null);
      let ultimo = -1;
      for (let m = 0; m < meses.length; m += 1) {
        if (meses[m] !== null) ultimo = m;
      }
      return {
        anio: s.anio,
        color: base[i % base.length] ?? 'var(--cgraf-1)',
        parcial: ultimo >= 0 && ultimo < 11,
        ultimo,
        ultimoValor: ultimo >= 0 ? (meses[ultimo] ?? 0) : 0,
      };
    });
  }, [ordenadas]);

  // Anti-colisión: agrupa etiquetas cuyos valores finales están muy cerca y
  // reparte cada grupo con separación vertical en px (dy), con tope.
  const dyEtiqueta = useMemo(() => {
    const brecha = (yMax * GAP_ETIQUETA_PX) / ALTO_TRAZADO_PX;
    const items = [...lineas]
      .filter((l) => l.ultimo >= 0)
      .sort((a, b) => a.ultimoValor - b.ultimoValor);
    const grupos: typeof items[] = [];
    for (const it of items) {
      const g = grupos[grupos.length - 1];
      if (g && g.length > 0 && it.ultimoValor - (g[g.length - 1]?.ultimoValor ?? 0) <= brecha) {
        g.push(it);
      } else {
        grupos.push([it]);
      }
    }
    const dy = new Map<number, number>();
    for (const g of grupos) {
      g.forEach((it, k) => {
        const d = (k - (g.length - 1) / 2) * GAP_ETIQUETA_PX;
        dy.set(it.anio, Math.max(-48, Math.min(48, d)));
      });
    }
    return dy;
  }, [lineas, yMax]);

  const datos = useMemo(
    () =>
      MESES.map((mes, i) => {
        const fila: Record<string, number | string | null> = { mes };
        for (const s of ordenadas) fila[String(s.anio)] = s.meses[i] ?? null;
        return fila;
      }),
    [ordenadas],
  );

  if (ordenadas.length === 0) {
    return <p className="py-10 text-center text-xs text-tinta/55">Sin datos para el rango seleccionado.</p>;
  }

  return (
    <div>
      <style>{'@keyframes pulsoXuma { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }'}</style>
      <div style={{ height: 430 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 16, right: 56, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 11, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tickFormatter={(v: number) => formatNum(v)}
              tick={{ fill: 'var(--ctinta-suave)', fontSize: 10.5 }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const filas = payload
                  .filter((p) => p.value !== null && p.value !== undefined)
                  .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
                if (filas.length === 0) return null;
                return (
                  <div style={GLASS_TOOLTIP as React.CSSProperties}>
                    <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{String(label ?? '')}</p>
                    {filas.map((p) => (
                      <p key={String(p.dataKey)} style={{ margin: 0 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            background: String(p.color ?? p.stroke),
                            marginRight: 6,
                          }}
                        />
                        {String(p.name)}: <b>{formatNum(Number(p.value ?? 0))}</b>
                      </p>
                    ))}
                  </div>
                );
              }}
              cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }}
            />
            {lineas.map((l) => {
              const atenuada = resaltado !== null && resaltado !== l.anio;
              const dy = dyEtiqueta.get(l.anio) ?? 0;
              return (
                <Line
                  key={l.anio}
                  type="monotone"
                  dataKey={String(l.anio)}
                  name={String(l.anio)}
                  stroke={l.color}
                  strokeWidth={l.parcial ? 3.4 : resaltado === l.anio ? 3 : l.anio < 2022 ? 1.6 : 2.2}
                  strokeOpacity={atenuada ? 0.15 : l.parcial ? 1 : l.anio < 2022 ? 0.75 : 1}
                  connectNulls={false}
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    const { cx, cy, index } = props;
                    if (cx === undefined || cy === undefined || index === undefined) return <g />;
                    if (index !== l.ultimo) return <g />;
                    const op = atenuada ? 0.15 : 1;
                    if (l.parcial) {
                      // Año en curso: píldora con el año + punto pulsante.
                      return (
                        <g style={{ opacity: op }}>
                          <circle cx={cx} cy={cy} r={5} fill={l.color} opacity={0.45}>
                            <animate attributeName="r" values="5;11;5" dur="1.8s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.45;0;0.45" dur="1.8s" repeatCount="indefinite" />
                          </circle>
                          <circle cx={cx} cy={cy} r={4.5} fill={l.color} stroke="#ffffff" strokeWidth={2} />
                          <rect
                            x={cx + 10}
                            y={cy - 10 + dy}
                            width={40}
                            height={20}
                            rx={10}
                            fill={l.color}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                          <text
                            x={cx + 30}
                            y={cy + 4.5 + dy}
                            textAnchor="middle"
                            fontSize={11}
                            fontWeight={800}
                            fill="#ffffff"
                            fontFamily="'Raleway', sans-serif"
                          >
                            {l.anio}
                          </text>
                        </g>
                      );
                    }
                    return (
                      <g style={{ opacity: op }}>
                        {Math.abs(dy) > 1 ? (
                          <line x1={cx + 4} y1={cy} x2={cx + 9} y2={cy + dy + 3} stroke={l.color} strokeWidth={1} opacity={0.6} />
                        ) : null}
                        <circle cx={cx} cy={cy} r={3} fill={l.color} />
                        <text
                          x={cx + 12}
                          y={cy + 4 + dy}
                          fontSize={11}
                          fontWeight={800}
                          fill={l.color}
                          fontFamily="'Raleway', sans-serif"
                        >
                          {l.anio}
                        </text>
                      </g>
                    );
                  }}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/70">
        {lineas.map((l) => (
          <button
            key={l.anio}
            type="button"
            onMouseEnter={() => setResaltado(l.anio)}
            onMouseLeave={() => setResaltado(null)}
            onFocus={() => setResaltado(l.anio)}
            onBlur={() => setResaltado(null)}
            className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 outline-none transition-opacity"
            style={{ opacity: resaltado !== null && resaltado !== l.anio ? 0.4 : 1 }}
            title={l.parcial && l.ultimo >= 0 ? `${l.anio} (parcial, hasta ${MESES[l.ultimo]})` : String(l.anio)}
          >
            <span
              className="h-0.5 w-4 rounded-full"
              style={{
                background: l.color,
                height: l.parcial ? 3 : undefined,
                animation: l.parcial ? 'pulsoXuma 1.8s ease-in-out infinite' : undefined,
              }}
            />
            {l.anio}
            {l.parcial ? ' (parcial)' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
