import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PuntoForecast } from '../../lib/types';
import { formatCOP, formatCOPCompact, formatNum } from '../../utils/formatters';
import { GLASS_TOOLTIP } from './palette';

interface Props {
  data: PuntoForecast[];
  anioObjetivo: number;
  anioPrevio: number;
  compact?: boolean;
}

interface Fila {
  label: string;
  sin: number;
  sinRango: [number, number];
  monto: number;
  montoRango: [number, number];
  referencia: number;
}

const COLORES_MES = [
  '#1e40af', '#0e7490', '#0d9488', '#059669', '#16a34a', '#65a30d',
  '#ca8a04', '#ea580c', '#dc2626', '#9333ea', '#7c3aed', '#2563eb',
];

function EtiquetaPildora(props: { x?: number | string; y?: number | string; value?: number | string }) {
  const cx = Number(props.x);
  const cy = Number(props.y);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const texto = typeof props.value === 'number' ? formatNum(props.value) : String(props.value ?? '');
  if (!texto) return null;
  const alto = 21;
  const ancho = texto.length * 7 + 14;
  const py = cy - 14;
  return (
    <g>
      <rect x={cx - ancho / 2} y={py - alto / 2} width={ancho} height={alto} rx={alto / 2} fill="var(--cpanel-fondo)" fillOpacity={0.97} stroke="var(--cglass-borde)" strokeOpacity={0.9} />
      <text x={cx} y={py + 0.5} textAnchor="middle" dominantBaseline="central" fill="var(--ctinta)" fontSize={12} fontWeight={800} fontFamily="'Raleway', sans-serif">{texto}</text>
    </g>
  );
}

export default function ForecastChart({ data, anioObjetivo, anioPrevio, compact = false }: Props) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-xs text-tinta/55">Sin datos para el rango seleccionado.</p>;
  }
  const filas: Fila[] = data.map((p) => ({
    label: p.label, sin: p.siniestros, sinRango: [p.sinLow, p.sinHigh], monto: p.monto, montoRango: [p.montoLow, p.montoHigh], referencia: p.refAnioPrevio
  }));
  return (
    <div className="flex min-h-0 flex-col overflow-hidden gap-0">
      <div className={compact ? "h-[190px] w-full xl:h-[180px]" : "h-[285px] w-full xl:h-[270px]"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filas} margin={{ top: 28, right: 8, left: 8, bottom: 4 }} barCategoryGap="14%">
            <CartesianGrid strokeDasharray="3 6" stroke="var(--ccurtina)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--ctinta)', fontSize: 13, fontWeight: 800 }} axisLine={false} tickLine={false} interval={0} height={22} tickMargin={4} />
            <YAxis yAxisId="si" tickFormatter={(v: number) => formatNum(v)} tick={{ fill: 'var(--ctinta-suave)', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={56} />
            <YAxis yAxisId="dinero" orientation="right" tickFormatter={(v: number) => (v === 0 ? '0' : formatCOPCompact(v))} tick={{ fill: 'var(--ctinta-suave)', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || payload.length === 0) return null;
                const fila = filas.find((f) => f.label === String(label ?? ''));
                return (
                  <div style={GLASS_TOOLTIP as React.CSSProperties}>
                    <p style={{ margin: 0, fontWeight: 700, marginBottom: 4 }}>{String(label ?? '')} {anioObjetivo}</p>
                    {fila && (
                      <>
                        <p style={{ margin: 0 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--cgraf-1)', marginRight: 6 }} />Siniestros: <b>{formatNum(fila.sin)}</b><span style={{ opacity: 0.7 }}> (80%: {formatNum(fila.sinRango[0])}–{formatNum(fila.sinRango[1])})</span></p>
                        <p style={{ margin: 0 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: 'var(--cgraf-2)', marginRight: 6 }} />Pagado: <b>{formatCOP(fila.monto)}</b><span style={{ opacity: 0.7 }}> (80%: {formatCOPCompact(fila.montoRango[0])}–{formatCOPCompact(fila.montoRango[1])})</span></p>
                        <p style={{ margin: 0, opacity: 0.75 }}>Real {anioPrevio}: <b>{formatNum(fila.referencia)}</b></p>
                      </>
                    )}
                  </div>
                );
              }}
              cursor={{ fill: 'var(--csombra-cursor)' }}
            />
            <Bar yAxisId="si" dataKey="sin" name={`Siniestros ${anioObjetivo}`} radius={[6, 6, 0, 0]} barSize={36} animationDuration={1200} animationEasing="ease-out">
              {filas.map((_, i) => (
                <Cell key={`c-${i}`} fill={COLORES_MES[i % COLORES_MES.length]} />
              ))}
              <LabelList dataKey="sin" position="top" offset={12} content={<EtiquetaPildora />} />
            </Bar>
            <Line yAxisId="si" type="monotone" dataKey="referencia" name={`Real ${anioPrevio}`} stroke="var(--ctinta-suave)" strokeDasharray="5 4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} animationDuration={1400} />
            <Line yAxisId="dinero" type="monotone" dataKey="monto" name={`Pagado ${anioObjetivo}`} stroke="var(--cgraf-2)" strokeWidth={3} dot={{ r: 4, fill: 'var(--cgraf-2)', stroke: 'var(--qtooltip-fondo)', strokeWidth: 1.5 }} activeDot={{ r: 6, fill: 'var(--cgraf-2)', stroke: '#ffffff', strokeWidth: 2 }} animationDuration={1400} animationEasing="ease-out" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] leading-none text-tinta/70">
        <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm" style={{ background: 'var(--cgraf-1)' }} />Siniestros {anioObjetivo}</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ background: 'var(--cgraf-2)' }} />Pagado {anioObjetivo} (COP)</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--ctinta-suave)' }} />Real {anioPrevio}</span>
      </div>
    </div>
  );
}
