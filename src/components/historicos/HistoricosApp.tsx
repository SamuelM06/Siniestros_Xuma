import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, CalendarRange, Coins, Percent, TrendingUp, Trophy } from 'lucide-react';
import type { Filters, HistoricosData, Metadatos } from '../../lib/types';
import { queryString } from '../../utils/fetcher';
import { formatNum } from '../../utils/formatters';
import Panel from '../dashboard/Panel';
import KpiCard from '../kpi/KpiCard';
import FiltrosPanel from '../filtros/FiltrosPanel';

const BarrasMensualesAnio = lazy(() => import('../charts/BarrasMensualesAnio'));
const TendenciaMensualHist = lazy(() => import('../charts/TendenciaMensualHist'));

function EsqueletoGrafico({ clases }: { clases: string }) {
  return <div className={`animate-pulse rounded-xl bg-tinta/5 ${clases}`} />;
}

interface Props {
  datosIniciales: HistoricosData;
  filtrosIniciales: Filters;
  metadatos: Metadatos;
}

export default function HistoricosApp({ datosIniciales, filtrosIniciales, metadatos }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);
  const [data, setData] = useState<HistoricosData>(datosIniciales);
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
      anio: undefined,
      gasera: undefined,
      producto: undefined,
      aseguradora: undefined,
      contrato: undefined,
      mes: undefined,
      estado: undefined,
      tipo_siniestro: undefined,
      desde: '2018-01-01',
      hasta: '2026-12-31',
    });
  }, []);

  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    let vivo = true;
    setCargando(true);
    const q = queryString(filtros);
    fetch(`/api/historicos?${q}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as HistoricosData;
      })
      .then((d) => {
        if (vivo) setData(d);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [filtros]);

  const { anios, mensual, tendencia, sinFecha } = data;
  const tend = tendencia ?? [];
  const totalHist = anios.reduce((s, a) => s + a.total, 0);
  const pagadosHist = anios.reduce((s, a) => s + a.pagados, 0);
  const totalPagadoHist = anios.reduce((s, a) => s + a.totalPagado, 0);
  const promedioPct = anios.length > 0
    ? Math.round((anios.reduce((s, a) => s + a.porcPagado, 0) / anios.length) * 10) / 10
    : 0;
  const pico = anios.reduce((max, a) => (a.total > max.total ? a : max), anios[0] ?? { anio: 0, total: 0, pagados: 0, objetados: 0, porcPagado: 0, totalPagado: 0 });

  const activos =
    (filtros.anio ? 1 : 0) +
    (filtros.mes ? 1 : 0) +
    (filtros.gasera ? 1 : 0) +
    (filtros.producto ? 1 : 0) +
    (filtros.aseguradora ? 1 : 0);

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Histórico de siniestros por año</h1>

      <FiltrosPanel
        filtros={filtros}
        metadatos={metadatos}
        onChange={cambioFiltro}
        onReset={resetFiltros}
        activos={activos}
        cargando={cargando}
        modoAnio
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          titulo="Total histórico"
          valor={totalHist}
          icono={<Trophy className="h-6 w-6" />}
          acento="azul"
          delay={0}
          sub={`${anios.length} año${anios.length === 1 ? '' : 's'} en rango`}
        />
        <KpiCard
          titulo="Promedio % pagado"
          valor={promedioPct}
          icono={<Percent className="h-6 w-6" />}
          acento="verde-claro"
          delay={0.06}
          sub={`${formatNum(pagadosHist)} pagados en total`}
        />
        <KpiCard
          titulo="Pico de casos"
          valor={pico.total}
          icono={<CalendarRange className="h-6 w-6" />}
          acento="violeta"
          delay={0.12}
          sub={pico.anio > 0 ? `Año ${pico.anio}${pico.anio === 2026 ? ' (parcial)' : ''}` : 'Sin datos'}
        />
        <KpiCard
          titulo="Total pagado histórico"
          valor={totalPagadoHist}
          icono={<Coins className="h-6 w-6" />}
          acento="verde-oscuro"
          delay={0.18}
          moneda
          sub="Suma de pagos válidos (2018–2026)"
        />
      </section>

      <Panel titulo="Comparativa mensual por año" icono={<BarChart3 className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />} delay={0.05}>
        <Suspense fallback={          <EsqueletoGrafico clases="h-[470px]" />}>
          <BarrasMensualesAnio series={mensual} />
        </Suspense>
      </Panel>

      <Panel titulo="Tendencia mensual: siniestros y dinero pagado" icono={<TrendingUp className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />} delay={0.1}>
        <Suspense fallback={          <EsqueletoGrafico clases="h-[340px]" />}>
          <TendenciaMensualHist data={tend} />
        </Suspense>
      </Panel>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/55">
        <span>Montos 2024 saneados (1 registro corrupto excluido de sumas).</span>
        <span>{formatNum(sinFecha)} casos sin fecha de radicación (no entran al eje de años).</span>
        <span>2026 es parcial (datos hasta septiembre).</span>
      </p>
    </div>
  );
}
