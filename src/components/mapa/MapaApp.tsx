import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building, Coins, Compass, Globe, MapPin, Trophy } from 'lucide-react';
import type { Filters, MapaData, Metadatos } from '../../lib/types';
import { queryString } from '../../utils/fetcher';
import { formatCOP, formatNum } from '../../utils/formatters';
import FiltrosPanel from '../filtros/FiltrosPanel';
import KpiCard from '../kpi/KpiCard';
import MapaColombia from './MapaColombia';

interface Props {
  metadatos: Metadatos;
  filtrosIniciales: Filters;
  mapaInicial: MapaData;
}

const DEFAULT_DESDE = '2026-01-01';
const DEFAULT_HASTA = '2026-12-31';

export default function MapaApp({ metadatos, filtrosIniciales, mapaInicial }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);
  const [data, setData] = useState<MapaData>(mapaInicial);
  const [cargando, setCargando] = useState(false);
  const [deptoSeleccionado, setDeptoSeleccionado] = useState<string | null>(null);

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
    setDeptoSeleccionado(null);
  }, []);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    const q = queryString(filtros);
    fetch(`/api/mapa?${q}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as MapaData;
      })
      .then((d) => {
        if (!vivo) return;
        setData(d);
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

  const deptoLider = useMemo(() => {
    if (!data.departamentos || data.departamentos.length === 0) return null;
    return data.departamentos[0];
  }, [data]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-xl font-extrabold text-tinta md:text-2xl">
            <Globe className="h-6 w-6 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
            Mapa de Siniestralidad Territorial
          </h1>
          <p className="text-xs text-tinta/60">
            Distribución geográfica de siniestros, concentración por departamento y municipios de cobertura.
          </p>
        </div>
      </header>

      {/* Filtros unificados */}
      <FiltrosPanel
        filtros={filtros}
        metadatos={metadatos}
        onChange={cambioFiltro}
        onReset={resetFiltros}
        activos={activos}
        cargando={cargando}
      />

      {/* KPIs territoriales */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          titulo="Total siniestros mapeados"
          valor={data.totalNacional}
          icono={<MapPin className="h-6 w-6" />}
          acento="azul"
          delay={0}
          sub="100% de casos georreferenciados"
        />

        <KpiCard
          titulo="Total pagado territorial"
          valor={data.totalPagadoNacional}
          icono={<Coins className="h-6 w-6" />}
          acento="verde-oscuro"
          delay={0.06}
          moneda
          sub="Suma acumulada en departamentos"
        />

        <KpiCard
          titulo="Departamento líder"
          valor={deptoLider ? deptoLider.total : 0}
          icono={<Trophy className="h-6 w-6" />}
          acento="verde-claro"
          delay={0.12}
          sub={deptoLider ? `${deptoLider.departamento} (${((deptoLider.total / Math.max(1, data.totalNacional)) * 100).toFixed(1)}%)` : 'Sin datos'}
        />

        <KpiCard
          titulo="Departamentos activos"
          valor={data.departamentos.length}
          icono={<Compass className="h-6 w-6" />}
          acento="violeta"
          delay={0.18}
          sub={`${data.departamentos.reduce((acc, d) => acc + d.municipios.length, 0)} municipios/zonas`}
        />
      </section>

      {/* Mapa interactivo y ranking */}
      <MapaColombia
        data={data}
        deptoSeleccionado={deptoSeleccionado}
        onSelectDepto={setDeptoSeleccionado}
      />
    </div>
  );
}
