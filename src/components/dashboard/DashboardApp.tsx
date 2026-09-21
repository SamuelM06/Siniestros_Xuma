import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Coins, FileText, Fuel, Landmark,
  OctagonX, PieChart, RefreshCw, TrendingUp, Trophy,
} from 'lucide-react';
import type { DashboardData, Filters } from '../../lib/types';
import { queryString } from '../../utils/fetcher';
import Panel from './Panel';
import KpiCard from '../kpi/KpiCard';
import FiltrosPanel from '../filtros/FiltrosPanel';

// Los gráficos se cargan bajo demanda: Recharts (~400 KB) se descarga en un chunk
// separado tras la carga inicial, así el tablero pinta primero los KPIs y filtros.
const TendenciaLineChart = lazy(() => import('../charts/TendenciaLineChart'));
const DonutChart = lazy(() => import('../charts/DonutChart'));
const BarChartGasera = lazy(() => import('../charts/BarChartGasera'));
const BarChartAseguradora = lazy(() => import('../charts/BarChartAseguradora'));

// Marcador de carga ligera mientras se descarga/ejecuta el chunk de los gráficos.
function EsqueletoGrafico({ clases }: { clases: string }) {
  return <div className={`animate-pulse rounded-xl bg-tinta/5 ${clases}`} />;
}

interface Props {
  datosIniciales: DashboardData;
  filtrosIniciales: Filters;
}

const DEFAULT_DESDE = '2026-01-01';
const DEFAULT_HASTA = '2026-12-31';

export default function DashboardApp({ datosIniciales, filtrosIniciales }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);
  const [data, setData] = useState<DashboardData>(datosIniciales);
  const [cargando, setCargando] = useState(false);

  const cambioFiltro = useCallback((cambio: Partial<Filters>) => {
    setFiltros((prev) => ({ ...prev, ...cambio }));
  }, []);

  const resetFiltros = useCallback(() => {
    setFiltros({
      contrato: undefined,
      mes: undefined,
      desde: DEFAULT_DESDE,
      hasta: DEFAULT_HASTA,
      gasera: undefined,
      producto: undefined,
      estado: undefined,
    });
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const q = queryString(filtros);
    const get = async <T,>(url: string): Promise<T> => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.statusText);
      return (await res.json()) as T;
    };
    Promise.all([
      get(`/api/kpis?${q}`),
      get(`/api/tendencia?${q}`),
      get(`/api/por-aseguradora?${q}`),
      get(`/api/por-gasera?${q}`),
      get(`/api/por-producto?${q}`),
    ])
      .then(([kpis, tendencia, porAseguradora, porGasera, porProducto]) => {
        if (!vivo) return;
        setData((prev) => ({
          kpis: kpis as DashboardData['kpis'],
          tendencia: tendencia as DashboardData['tendencia'],
          porAseguradora: porAseguradora as DashboardData['porAseguradora'],
          porGasera: porGasera as DashboardData['porGasera'],
          porProducto: porProducto as DashboardData['porProducto'],
          metadatos: prev.metadatos,
        }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [filtros]);

  const activos =
    (filtros.contrato ? 1 : 0) +
    (filtros.gasera ? 1 : 0) +
    (filtros.producto ? 1 : 0) +
    (filtros.estado ? 1 : 0) +
    (filtros.mes ? 1 : 0) +
    ((filtros.desde && filtros.desde !== DEFAULT_DESDE && !filtros.mes) ? 1 : 0) +
    ((filtros.hasta && filtros.hasta !== DEFAULT_HASTA && !filtros.mes) ? 1 : 0);

  const { kpis, tendencia, porAseguradora, porGasera, porProducto, metadatos } = data;

  return (
    <div className="space-y-3">
      {/* Título accesible (screen reader) para SEO/a11y */}
      <h1 className="sr-only">Tablero de siniestros 2026</h1>

      <FiltrosPanel filtros={filtros} metadatos={metadatos} onChange={cambioFiltro} onReset={resetFiltros} activos={activos} cargando={cargando} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <KpiCard
          titulo="Total siniestros"
          valor={kpis.total}
          icono={<Trophy className="h-6 w-6" />}
          acento="azul"
          delay={0}
          sub={
            kpis.comparativo.total2025 > 0
              ? `vs 2025 (${kpis.comparativo.total2025}) · ${kpis.comparativo.deltaPct >= 0 ? '+' : ''}${kpis.comparativo.deltaPct}%`
              : 'Comparativo sin datos'
          }
        />
        <KpiCard titulo="Pagados" valor={kpis.pagados} icono={<CheckCircle2 className="h-6 w-6" />} acento="verde-claro" delay={0.06} sub={`${Math.round((kpis.pagados / Math.max(1, kpis.total)) * 1000) / 10}% del total`} />
        <KpiCard titulo="Objetados" valor={kpis.objetados} icono={<OctagonX className="h-6 w-6" />} acento="violeta" delay={0.12} sub={`${Math.round((kpis.objetados / Math.max(1, kpis.total)) * 1000) / 10}% del total`} />
        <KpiCard titulo="Solicitud de documentos" valor={kpis.solicitudDocs} icono={<FileText className="h-6 w-6" />} acento="ambar" delay={0.18} sub="Documentos pendientes" />
        <KpiCard titulo="En trámite" valor={kpis.enTramite} icono={<RefreshCw className="h-6 w-6" />} acento="azul" delay={0.24} sub="Seguimiento / suspenso" />
        <KpiCard
          titulo="Total pagado a la fecha"
          valor={kpis.totalPagado}
          icono={<Coins className="h-6 w-6" />}
          acento="verde-oscuro"
          delay={0.15}
          moneda
          grande
          className="sm:col-span-2 lg:col-span-3 xl:col-span-2"
          sub="Suma de los valores pagados de los siniestros del periodo filtrado"
        />
      </section>

      {kpis.sinEstado > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-tinta/45">
          <OctagonX className="h-3.5 w-3.5 text-amber-400" />
          {kpis.sinEstado.toLocaleString('es-CO')} siniestros sin estado asignado en la fuente (se muestran en "Sin estado").
        </p>
      )}

      {/* Gráficos: tendencia + aseguradora/gasera a la izquierda; dona de productos grande al lateral */}
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Panel titulo="Tendencia mensual de siniestros y pagos" icono={<TrendingUp className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />} delay={0.05}>
            <Suspense fallback={<EsqueletoGrafico clases="h-64" />}>
              <TendenciaLineChart data={tendencia} />
            </Suspense>
          </Panel>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel titulo="Siniestros por aseguradora (total del periodo)" icono={<Landmark className="h-5 w-5 text-[#8b7bff]" />} delay={0.12}>
              <Suspense fallback={<EsqueletoGrafico clases="h-52" />}>
                <BarChartAseguradora data={porAseguradora} />
              </Suspense>
            </Panel>
            <Panel titulo="Por gasera" icono={<Fuel className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />} delay={0.16}>
              <Suspense fallback={<EsqueletoGrafico clases="h-52" />}>
                <BarChartGasera data={porGasera} />
              </Suspense>
            </Panel>
          </div>
        </div>
        <Panel titulo="Porciones por producto" icono={<PieChart className="h-5 w-5 text-[#8b7bff]" />} delay={0.09} className="flex h-full flex-col">
          <Suspense fallback={<EsqueletoGrafico clases="min-h-[300px] flex-1" />}>
            <DonutChart data={porProducto} />
          </Suspense>
        </Panel>
      </section>
    </div>
  );
}