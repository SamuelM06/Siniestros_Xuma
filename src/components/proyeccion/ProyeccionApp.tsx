import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, BarChart3, Calendar, CalendarRange, Coins, MapPin, Sparkles, TrendingDown, TrendingUp, Trophy, Minus,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { Filters, Metadatos, ProyeccionData } from '../../lib/types';
import { queryString } from '../../utils/fetcher';
import { formatCOP, formatCOPMilesM, formatNum } from '../../utils/formatters';
import Panel from '../dashboard/Panel';
import KpiCard from '../kpi/KpiCard';
import FiltrosPanel from '../filtros/FiltrosPanel';
import ForecastChart from '../charts/ForecastChart';
import EstacionalidadChart from '../charts/EstacionalidadChart';
import ProbabilidadGeo from '../proyeccion/ProbabilidadGeo';
import ProbabilidadCategorica from '../proyeccion/ProbabilidadCategorica';

interface Props {
  datosIniciales: ProyeccionData;
  filtrosIniciales: Filters;
  metadatos: Metadatos;
}

export default function ProyeccionApp({ datosIniciales, filtrosIniciales, metadatos }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);
  const [data, setData] = useState<ProyeccionData>(datosIniciales);
  const [cargando, setCargando] = useState(false);
  const primeraCarga = useRef(true);

  const cambioFiltro = useCallback((cambio: Partial<Filters>) => {
    setFiltros((prev) => {
      const next = { ...prev, ...cambio };
      const claves = Object.keys(cambio) as (keyof Filters)[];
      if (claves.every((k) => prev[k] === next[k])) return prev;
      return next;
    });
  }, []);

  const resetFiltros = useCallback(() => {
    setFiltros({
      anio: undefined, gasera: undefined, producto: undefined,
      aseguradora: undefined, contrato: undefined, mes: undefined,
      estado: undefined, tipo_siniestro: undefined,
      desde: '2018-01-01', hasta: '2026-12-31',
    });
  }, []);

  useEffect(() => {
    if (primeraCarga.current) { primeraCarga.current = false; return; }
    let vivo = true;
    setCargando(true);
    const q = queryString(filtros);
    fetch(`/api/proyeccion?${q}`)
      .then(async (res) => { if (!res.ok) throw new Error(res.statusText); return (await res.json()) as ProyeccionData; })
      .then((d) => { if (vivo) setData(d); })
      .catch(() => undefined)
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [filtros]);

  const { forecast, estacionalidad, tendencia, departamentos, tiposSiniestro, backtest, cambios, supuestos, anioObjetivo, aniosEntrenamiento } = data;

  const activos =
    (filtros.gasera ? 1 : 0) + (filtros.producto ? 1 : 0) + (filtros.aseguradora ? 1 : 0);

  const deptoTop = useMemo(() => {
    if (departamentos.length === 0) return null;
    return [...departamentos].sort((a, b) => b.prob - a.prob)[0] ?? null;
  }, [departamentos]);

  const mesPico = useMemo(() => {
    if (forecast.length === 0) return null;
    return [...forecast].sort((a, b) => b.siniestros - a.siniestros)[0] ?? null;
  }, [forecast]);

  const top3Deptos = useMemo(() => [...departamentos].sort((a, b) => b.prob - a.prob).slice(0, 3), [departamentos]);

  const IconoCrecimiento = tendencia.direccion === 'alza' ? TrendingUp : tendencia.direccion === 'baja' ? TrendingDown : Minus;

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Proyección estadística de siniestros</h1>

      <FiltrosPanel
        filtros={filtros}
        metadatos={metadatos}
        onChange={cambioFiltro}
        onReset={resetFiltros}
        activos={activos}
        cargando={cargando}
        modoProyeccion
      />
      <p className="px-1 text-[10px] leading-tight text-tinta/45">Proyección probabilística {anioObjetivo} basada en {aniosEntrenamiento.length} años cerrados ({aniosEntrenamiento[0] ?? 2018}–{aniosEntrenamiento[aniosEntrenamiento.length - 1] ?? 2025}). Filtra por gasera, aseguradora o producto para recalcular la probabilidad del segmento.</p>

      {/* KPIs superiores: 4 tarjetas */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          titulo={`Siniestros ${anioObjetivo}`}
          valor={tendencia.totalProyAnual}
          icono={<Trophy className="h-6 w-6" />}
          acento="azul"
          delay={0}
          centrado
          sub={`${aniosEntrenamiento.length} años de entrenamiento`}
        />
        <KpiCard
          titulo="Pagado proyectado"
          valor={tendencia.montoProyAnual}
          icono={<Coins className="h-6 w-6" />}
          acento="verde-oscuro"
          delay={0.06}
          moneda
          centrado
          compacto
          sub="Estimación anual COP"
        />
        {/* Depto con mayor probabilidad — reemplaza Precisión */}
        <motion.article
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="glass glass-hover relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl p-4 text-center shadow-[0_0_35px_-10px_rgba(240,180,41,0.55)]"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#f0b429] to-[#ef7a6b]" />
          <span className="text-xl drop-shadow text-[#b45309] dark:text-[#ffd98a]"><MapPin className="h-6 w-6" /></span>
          <p className="mt-1 text-sm font-semibold text-tinta/70">Depto con mayor riesgo</p>
          <p className="tabular mt-2 line-clamp-1 text-xl font-extrabold tracking-tight text-tinta md:text-2xl" title={deptoTop?.nombre ?? '—'}>
            {deptoTop?.nombre ?? '—'}
          </p>
          <p className="mt-1 text-[11px] font-bold tabular text-tinta/80">
            {deptoTop ? `${(deptoTop.prob * 100).toFixed(1)}% prob · ${formatNum(deptoTop.casos)} casos` : 'Sin datos'}
          </p>
          {deptoTop && (
            <p className="mt-0.5 text-[10px] text-tinta/50">IC 95% {(deptoTop.low * 100).toFixed(1)}%–{(deptoTop.high * 100).toFixed(1)}%</p>
          )}
        </motion.article>
        {/* Mes pico proyectado */}
        <motion.article
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="glass glass-hover relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl p-4 text-center shadow-[0_0_35px_-10px_rgba(139,123,255,0.6)]"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8b7bff] to-[#3d22c8]" />
          <span className="text-xl drop-shadow text-[#6a4fd8] dark:text-[#b8c0ff]"><Calendar className="h-6 w-6" /></span>
          <p className="mt-1 text-sm font-semibold text-tinta/70">Mes pico proyectado</p>
          <p className="tabular mt-2 text-3xl font-extrabold tracking-tight text-tinta md:text-4xl">
            {mesPico ? formatNum(mesPico.siniestros) : '—'}
          </p>
          <p className="mt-1 text-xs font-semibold text-tinta/60">
            {mesPico ? `${mesPico.label} ${anioObjetivo}` : 'Sin datos'}
          </p>
          {mesPico && (
            <p className="mt-0.5 text-[10px] text-tinta/50">Rango 80%: {formatNum(mesPico.sinLow)}–{formatNum(mesPico.sinHigh)}</p>
          )}
        </motion.article>
      </div>

      {/* Fila 1: Forecast + Estacionalidad (estacionalidad más grande, no agrupado) */}
      <div className="grid gap-3 xl:grid-cols-[1.55fr_380px]">
        <Panel
          titulo={`Pronóstico ${anioObjetivo}: siniestros y dinero pagado`}
          icono={<TrendingUp className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
          delay={0.05}
          className="xl:p-4"
        >
          <ForecastChart data={forecast} anioObjetivo={anioObjetivo} anioPrevio={aniosEntrenamiento[aniosEntrenamiento.length - 1] ?? 2025} />
        </Panel>
        <Panel
          titulo="Índice estacional · alerta de picos"
          icono={<CalendarRange className="h-5 w-5 text-xuma-ambar" />}
          delay={0.1}
          className="glass rounded-3xl p-4 xl:p-4 border border-amber-400/10"
        >
          <EstacionalidadChart data={estacionalidad} />
        </Panel>
      </div>

      {/* Fila 2: Probabilidades + lateral destacado */}
      <div className="grid gap-3 xl:grid-cols-[1fr_1fr_360px]">
        <Panel
          titulo="Probabilidad por departamento"
          icono={<Trophy className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
          delay={0.12}
          className="xl:p-4"
        >
          {top3Deptos.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {top3Deptos.map((d, i) => (
                <span key={d.nombre} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${i === 0 ? 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-tinta/10 bg-tinta/5 text-tinta/70'}`}>
                  <span className="tabular">{i + 1}. {d.nombre}</span>
                  <span className="tabular opacity-80">{(d.prob * 100).toFixed(1)}%</span>
                </span>
              ))}
            </div>
          )}
          <ProbabilidadGeo titulo="Departamentos" data={departamentos} icono={null} />
        </Panel>
        <Panel
          titulo="Probabilidad por tipo de siniestro"
          icono={<BarChart3 className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
          delay={0.14}
          className="xl:p-4"
        >
          <ProbabilidadCategorica titulo="Tipos" data={tiposSiniestro} />
        </Panel>
        <aside className="space-y-3">
          <Panel
            titulo="Tendencia anual"
            icono={<IconoCrecimiento className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
            delay={0.16}
            className="xl:p-4"
          >
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-tinta/65">Dirección</span><b>{tendencia.direccion === 'alza' ? '📈 Alza' : tendencia.direccion === 'baja' ? '📉 Baja' : '➡️ Estable'}</b></div>
              <div className="flex justify-between"><span className="text-tinta/65">Pendiente</span><b>{tendencia.pendienteAnual >= 0 ? '+' : ''}{tendencia.pendienteAnual} casos/año</b></div>
              <div className="flex justify-between"><span className="text-tinta/65">p-value</span><b>{tendencia.pValue < 0.05 ? `❌ ${tendencia.pValue}` : `✅ ${tendencia.pValue}`}</b></div>
              <div className="flex justify-between"><span className="text-tinta/65">Crecimiento</span><b>{tendencia.crecimientoVsPrevio >= 0 ? '+' : ''}{tendencia.crecimientoVsPrevio}%</b></div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-tinta/5 px-2 py-1">
                <span className="text-[10px] font-semibold text-tinta/60">Precisión walk-forward</span>
                <span className={`text-[10px] font-bold ${backtest.confiable ? 'text-xuma-verde-claro' : 'text-amber-600'}`}>{backtest.mape !== null ? `MAPE ${backtest.mape}%` : 'Sin historia'} {backtest.confiable ? '✓' : ''}</span>
              </div>
            </div>
          </Panel>
          <Panel
            titulo="Cambio estructural"
            icono={<AlertCircle className="h-5 w-5 text-xuma-ambar" />}
            delay={0.2}
            className="xl:p-4"
          >
            <div className="space-y-1.5 text-[11px]">
              {cambios.map((c) => (
                <div key={c.dimension} className="flex justify-between">
                  <span className="text-tinta/65">{c.dimension}</span>
                  <b className={c.hayCambio ? 'text-red-400' : 'text-xuma-verde-claro'}>
                    p={c.pValue < 0.05 ? '❌' : '✅'} {c.pValue}
                  </b>
                </div>
              ))}
            </div>
          </Panel>
          {/* Supuestos metodológicos — barra lateral resaltada */}
          <section className="glass rounded-3xl p-4 xl:p-4 border border-amber-400/20 bg-gradient-to-br from-amber-500/[0.07] via-orange-500/[0.04] to-amber-500/[0.07] shadow-[0_8px_32px_-12px_rgba(245,158,11,0.35)]">
            <header className="mb-2 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /></span>
              <div>
                <h2 className="text-sm font-extrabold leading-none text-tinta">Supuestos metodológicos</h2>
                <p className="text-[10px] font-semibold leading-none text-amber-700/70 dark:text-amber-300/70">Alertas de lo que puede pasar</p>
              </div>
              <span className="ml-auto hidden items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-amber-700 dark:text-amber-300 sm:inline-flex"><Sparkles className="h-3 w-3" /> {anioObjetivo}</span>
            </header>
            <ul className="space-y-1.5">
              {supuestos.map((s, i) => (
                <li key={i} className="flex gap-2 text-[10px] leading-snug text-tinta/75">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold leading-snug text-amber-800/80 dark:text-amber-200/80">
              Usa los filtros de gasera / aseguradora / producto para recalcular estas alertas sobre el segmento de interés.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
