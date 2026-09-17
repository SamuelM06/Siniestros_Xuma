import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2, Coins, Database, FileText, Fuel, Landmark, LayoutDashboard,
  OctagonX, PieChart, RefreshCw, TrendingUp, Trophy,
} from 'lucide-react';
import type { DashboardData, Filters } from '../../lib/types';
import { queryString } from '../../utils/fetcher';
import Panel from './Panel';
import KpiCard from '../kpi/KpiCard';
import TendenciaLineChart from '../charts/TendenciaLineChart';
import DonutChart from '../charts/DonutChart';
import BarChartGasera from '../charts/BarChartGasera';
import BarChartAseguradora from '../charts/BarChartAseguradora';
import FiltrosPanel from '../filtros/FiltrosPanel';
import TablaSiniestros from '../tabla/TablaSiniestros';

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
    (filtros.mes ? 1 : 0) +
    ((filtros.desde && filtros.desde !== DEFAULT_DESDE && !filtros.mes) ? 1 : 0) +
    ((filtros.hasta && filtros.hasta !== DEFAULT_HASTA && !filtros.mes) ? 1 : 0);

  const { kpis, tendencia, porAseguradora, porGasera, porProducto, metadatos } = data;

  return (
    <div className="space-y-6">
      <FiltrosPanel filtros={filtros} metadatos={metadatos} onChange={cambioFiltro} onReset={resetFiltros} activos={activos} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold text-tinta md:text-3xl">
            <LayoutDashboard className="h-7 w-7 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
            Tablero de siniestros <span className="texto-brillo">2026</span>
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-tinta/55">
            <Database className="h-4 w-4 text-tinta-dim" />
            Fuente: <code className="rounded bg-tinta/10 px-1.5 py-0.5 text-[11px] text-xuma-verde-oscuro dark:text-xuma-verde-claro">siniestros.casos</code> · Datos al cierre de agosto
          </p>
        </div>
        <AnimatePresence>
          {cargando && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-3.5 py-1.5 text-xs font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Actualizando…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
      </section>

      {/* Tarjeta grande: total pagado en COP */}
      <KpiCard
        titulo="Total pagado a la fecha"
        valor={kpis.totalPagado}
        icono={<Coins className="h-7 w-7" />}
        acento="verde-oscuro"
        delay={0.15}
        moneda
        grande
        sub="Suma de los valores pagados de todos los siniestros del periodo filtrado"
      />

      {kpis.sinEstado > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-tinta/45">
          <OctagonX className="h-3.5 w-3.5 text-amber-400" />
          {kpis.sinEstado.toLocaleString('es-CO')} siniestros sin estado asignado en la fuente (se muestran en “Sin estado”).
        </p>
      )}

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel titulo="Tendencia mensual" icono={<TrendingUp className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />} className="lg:col-span-2" delay={0.05}>
          <TendenciaLineChart data={tendencia} />
        </Panel>
        <Panel titulo="Porciones por producto" icono={<PieChart className="h-5 w-5 text-[#8b7bff]" />} delay={0.12}>
          <DonutChart data={porProducto} />
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel titulo="Siniestros por aseguradora al mes" icono={<Landmark className="h-5 w-5 text-[#8b7bff]" />} className="lg:col-span-2" delay={0.05}>
          <BarChartAseguradora data={porAseguradora} />
        </Panel>
        <Panel titulo="Por gasera" icono={<Fuel className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />} delay={0.12}>
          <BarChartGasera data={porGasera} />
        </Panel>
      </section>

      <TablaSiniestros filtros={filtros} />
    </div>
  );
}