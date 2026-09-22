import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3, CalendarRange, Coins, TrendingDown, TrendingUp, Trophy,
  Minus, AlertCircle,
} from 'lucide-react';
import type { Filters, Metadatos, ProyeccionData } from '../../lib/types';
import { queryString } from '../../utils/fetcher';
import { formatCOP, formatNum } from '../../utils/formatters';
import Panel from '../dashboard/Panel';
import KpiCard from '../kpi/KpiCard';
import FiltrosPanel from '../filtros/FiltrosPanel';
import ForecastChart from '../charts/ForecastChart';
import EstacionalidadChart from '../charts/EstacionalidadChart';
import ProbabilidadGeo from '../proyeccion/ProbabilidadGeo';
import ProbabilidadCategorica from '../proyeccion/ProbabilidadCategorica';

function EsqueletoGrafico({ clases }: { clases: string }) {
  return <div className={`animate-pulse rounded-xl bg-tinta/5 ${clases}`} />;
}

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

  // KPI del crecimiento con icono direccional.
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
        modoAnio
      />

      {/* KPIs superiores: 4 tarjetas en fila */}
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
        <KpiCard
          titulo="Tendencia"
          valor={Math.abs(tendencia.crecimientoVsPrevio)}
          icono={<IconoCrecimiento className="h-6 w-6" />}
          acento={tendencia.direccion === 'alza' ? 'ambar' : tendencia.direccion === 'baja' ? 'verde-claro' : 'violeta'}
          delay={0.12}
          centrado
          sub={tendencia.significante ? 'Significativo (p<0.05)' : 'Sin tendencia clara'}
        />
        <KpiCard
          titulo="Precisión modelo"
          valor={backtest.mape ?? 0}
          icono={<BarChart3 className="h-6 w-6" />}
          acento={backtest.confiable ? 'verde-claro' : 'ambar'}
          delay={0.18}
          centrado
          sub={backtest.mape !== null ? `MAPE ${backtest.mape}%` : 'Sin historia'}
        />
      </div>

      {/* Fila 1: Forecast + Estacionalidad */}
      <div className="grid gap-3 xl:grid-cols-[1fr_280px]">
        <Panel
          titulo={`Pronóstico ${anioObjetivo}: siniestros y dinero pagado`}
          icono={<TrendingUp className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
          delay={0.05}
          className="xl:p-3"
        >
          <Suspense fallback={<EsqueletoGrafico clases="h-[300px] xl:h-[260px]" />}>
            <ForecastChart data={forecast} anioObjetivo={anioObjetivo} anioPrevio={aniosEntrenamiento[aniosEntrenamiento.length - 1] ?? 2025} />
          </Suspense>
        </Panel>
        <Panel
          titulo="Índice estacional"
          icono={<CalendarRange className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
          delay={0.1}
          className="xl:p-3"
        >
          <Suspense fallback={<EsqueletoGrafico clases="h-[260px] xl:h-[220px]" />}>
            <EstacionalidadChart data={estacionalidad} />
          </Suspense>
        </Panel>
      </div>

      {/* Fila 2: Probabilidades + Tendencia */}
      <div className="grid gap-3 xl:grid-cols-[1fr_1fr_280px]">
        <Panel
          titulo="Probabilidad por departamento"
          icono={<Trophy className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
          delay={0.12}
          className="xl:p-3"
        >
          <ProbabilidadGeo titulo="Departamentos" data={departamentos} icono={null} />
        </Panel>
        <Panel
          titulo="Probabilidad por tipo de siniestro"
          icono={<BarChart3 className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
          delay={0.14}
          className="xl:p-3"
        >
          <ProbabilidadCategorica titulo="Tipos" data={tiposSiniestro} />
        </Panel>
        <aside className="space-y-3">
          <Panel
            titulo="Tendencia anual"
            icono={<TrendingUp className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />}
            delay={0.16}
            className="xl:p-3"
          >
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-tinta/65">Dirección</span><b>{tendencia.direccion === 'alza' ? '📈 Alza' : tendencia.direccion === 'baja' ? '📉 Baja' : '➡️ Estable'}</b></div>
              <div className="flex justify-between"><span className="text-tinta/65">Pendiente</span><b>{tendencia.pendienteAnual >= 0 ? '+' : ''}{tendencia.pendienteAnual} casos/año</b></div>
              <div className="flex justify-between"><span className="text-tinta/65">p-value</span><b>{tendencia.pValue < 0.05 ? `❌ ${tendencia.pValue}` : `✅ ${tendencia.pValue}`}</b></div>
              <div className="flex justify-between"><span className="text-tinta/65">Crecimiento</span><b>{tendencia.crecimientoVsPrevio >= 0 ? '+' : ''}{tendencia.crecimientoVsPrevio}%</b></div>
            </div>
          </Panel>
          <Panel
            titulo="Cambio estructural"
            icono={<AlertCircle className="h-5 w-5 text-xuma-ambar" />}
            delay={0.2}
            className="xl:p-3"
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
        </aside>
      </div>

      {/* Nota metodológica */}
      <details className="glass rounded-2xl px-3 py-2 text-[10px] text-tinta/55">
        <summary className="cursor-pointer font-bold text-tinta/70">Supuestos metodológicos</summary>
        <div className="mt-2 space-y-0.5">
          {supuestos.map((s, i) => (
            <p key={i}>· {s}</p>
          ))}
        </div>
      </details>
    </div>
  );
}