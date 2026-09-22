import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SerieMensualAnio } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import { CHART_COLORS, COLOR_OTROS, GLASS_TOOLTIP } from './palette';

interface Props {
  series: SerieMensualAnio[];
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Comparativa interanual: meses en el eje X y una línea por cada año.
// Colores fijos por año para que cada año siempre tenga el mismo color.
export default function TendenciaAnualChart({ series }: Props) {
  const ordenadas = useMemo(
    () => [...series].sort((a, b) => a.anio - b.anio),
    [series],
  );

  const conColor = useMemo(() => {
    const base = [...CHART_COLORS, COLOR_OTROS];
    return ordenadas.map((s, i) => ({
      anio: s.anio,
      color: base[i % base.length] ?? 'var(--cgraf-1)',
    }));
  }, [ordenadas]);

  const colorDe = (anio: number): string =>
    conColor.find((c) => c.anio === anio)?.color ?? 'var(--cgraf-1)';

  const datos = useMemo(
    () =>
      MESES.map((mes, i) => {
        const fila: Record<string, number | string> = { mes };
        for (const s of ordenadas) fila[String(s.anio)] = s.meses[i] ?? 0;
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
          <LineChart data={datos} margin={{ top: 16, right: 8, left: 4, bottom: 0 }}>
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
                const filas = [...payload].sort(
                  (a, b) => Number(b.value ?? 0) - Number(a.value ?? 0),
                );
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
                        {String(p.name)}
                        {Number(p.name) === 2026 ? ' (parcial)' : ''}:{' '}
                        <b>{formatNum(Number(p.value ?? 0))}</b>
                      </p>
                    ))}
                  </div>
                );
              }}
              cursor={{ stroke: 'var(--ccurtina)', strokeWidth: 2, strokeDasharray: '4 4' }}
            />
            {ordenadas.map((s) => (
              <Line
                key={s.anio}
                type="monotone"
                dataKey={String(s.anio)}
                name={String(s.anio)}
                stroke={colorDe(s.anio)}
                strokeWidth={s.anio === 2026 ? 3 : 2.2}
                dot={false}
                activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2 }}
                animationDuration={1200}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/70">
        {ordenadas.map((s) => (
          <span key={s.anio} className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded-full"
              style={{ background: colorDe(s.anio) }}
            />
            {s.anio}
            {s.anio === 2026 ? ' (parcial)' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
