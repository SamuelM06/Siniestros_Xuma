import { useCallback, useEffect, useMemo, useState } from 'react';
import { Compass, Coins, Globe, MapPin, Trophy } from 'lucide-react';
import type { Filters, MapaData, Metadatos } from '../../lib/types';
import { queryString } from '../../utils/fetcher';
import { formatCOP, formatNum } from '../../utils/formatters';
import FiltrosPanel from '../filtros/FiltrosPanel';
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
    <div className="flex flex-col h-[calc(100vh-62px)] overflow-hidden gap-2">
      {/* Título y Filtros en una sola línea horizontal compacta */}
      <div className="shrink-0 space-y-1.5">
        <FiltrosPanel
          filtros={filtros}
          metadatos={metadatos}
          onChange={cambioFiltro}
          onReset={resetFiltros}
          activos={activos}
          cargando={cargando}
        />

        {/* Tira compacta de métricas clave (altura mínima para evitar cualquier scroll) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-tinta/50 block">Siniestros Mapeados</span>
              <span className="text-sm font-black text-tinta leading-none">{formatNum(data.totalNacional)}</span>
            </div>
          </div>

          <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Coins className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-tinta/50 block">Total Pagado Territorial</span>
              <span className="text-sm font-black text-xuma-verde-oscuro dark:text-xuma-verde-claro leading-none truncate block" title={formatCOP(data.totalPagadoNacional)}>
                {formatCOP(data.totalPagadoNacional)}
              </span>
            </div>
          </div>

          <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Trophy className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-tinta/50 block">Dpto. Mayor Concentración</span>
              <span className="text-xs font-extrabold text-tinta leading-none truncate block">
                {deptoLider ? `${deptoLider.departamento} (${formatNum(deptoLider.total)})` : 'Sin datos'}
              </span>
            </div>
          </div>

          <div className="glass rounded-xl px-3 py-1.5 flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <Compass className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-semibold text-tinta/50 block">Departamentos Activos</span>
              <span className="text-sm font-black text-tinta leading-none">
                {data.departamentos.length} <span className="text-[10px] font-normal text-tinta/50">({data.departamentos.reduce((acc, d) => acc + d.municipios.length, 0)} zonas)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor flexible del Mapa Real y el Panel lateral (ocupa el 100% del espacio restante sin scroll) */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <MapaColombia
          data={data}
          deptoSeleccionado={deptoSeleccionado}
          onSelectDepto={setDeptoSeleccionado}
        />
      </div>
    </div>
  );
}
