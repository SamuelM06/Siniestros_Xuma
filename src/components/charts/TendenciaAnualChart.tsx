import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SerieMensualAnio } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, COLOR_OTROS, GLASS_TOOLTIP } from './palette';

interface Props {
  series: SerieMensualAnio[];
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Comparativa interanual: meses en el eje X y una línea por cada año.
// - El año en curso se corta en el último mes con dato (null = sin dato).
// - Cada línea lleva su año rotulado al final + resaltado al pasar el cursor
//   por la leyenda, para no depender solo del color.
export default function TendenciaAnualChart({ series }: Props) {
  const [resaltado, setResaltado] = useState<number | null>(null);

  const ordenadas = useMemo(
    () => [...series].sort((a, b) => a.anio - b.anio),
    [series],
  );

  const conColor = useMemo(() => {
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
      };
    });
  }, [ordenadas]);

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
      <div style={{ height: 300 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 16, right: 44, left: 4, bottom: 0 }}>
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
            {conColor.map((c) => {
              const atenuada = resaltado !== null && resaltado !== c.anio;
              return (
                <Line
                  key={c.anio}
                  type="monotone"
                  dataKey={String(c.anio)}
                  name={String(c.anio)}
                  stroke={c.color}
                  strokeWidth={resaltado === c.anio ? 3.5 : 2.2}
                  strokeOpacity={atenuada ? 0.15 : 1}
                  connectNulls={false}
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                  animationDuration={1200}
                  animationEasing="ease-out"
                  dot={(props: { cx?: number; cy?: number; index?: number }) => {
                    const { cx, cy, index } = props;
                    if (cx === undefined || cy === undefined || index === undefined) return <g />;
                    if (index !== c.ultimo) return <g />;
                    return (
                      <g style={{ opacity: atenuada ? 0.15 : 1 }}>
                        <circle cx={cx} cy={cy} r={4} fill={c.color} stroke="#ffffff" strokeWidth={1.5} />
                        <text
                          x={cx + 8}
                          y={cy + 4}
                          fontSize={11}
                          fontWeight={800}
                          fill={c.color}
                          fontFamily="'Raleway', sans-serif"
                        >
                          {c.anio}
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
        {conColor.map((c) => (
          <button
            key={c.anio}
            type="button"
            onMouseEnter={() => setResaltado(c.anio)}
            onMouseLeave={() => setResaltado(null)}
            onFocus={() => setResaltado(c.anio)}
            onBlur={() => setResaltado(null)}
            className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 outline-none transition-opacity"
            style={{ opacity: resaltado !== null && resaltado !== c.anio ? 0.4 : 1 }}
            title={c.parcial ? `${c.anio} (parcial, hasta ${MESES[c.ultimo]})` : String(c.anio)}
          >
            <span className="h-0.5 w-4 rounded-full" style={{ background: c.color }} />
            {c.anio}
            {c.parcial ? ' (parcial)' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
