import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, CheckCircle2, ChevronRight, Coins, Eye, HelpCircle, MapPin, RefreshCw, X, OctagonX } from 'lucide-react';
import { COLOMBIA_DEPTOS } from './colombiaPaths';
import type { ItemDepartamento, MapaData } from '../../lib/types';
import { formatCOP, formatNum } from '../../utils/formatters';

interface Props {
  data: MapaData;
  deptoSeleccionado: string | null;
  onSelectDepto: (depto: string | null) => void;
}

export default function MapaColombia({ data, deptoSeleccionado, onSelectDepto }: Props) {
  const [hovered, setHovered] = useState<{ depto: string; x: number; y: number } | null>(null);

  const deptoMap = useMemo(() => {
    const map = new Map<string, ItemDepartamento>();
    for (const d of data.departamentos) {
      map.set(d.departamento.toLowerCase(), d);
      // Normalizaciones comunes
      if (d.departamento === 'Valle del Cauca') map.set('valle', d);
      if (d.departamento === 'Bogotá D.C.') map.set('bogota', d);
    }
    return map;
  }, [data]);

  const maxCasos = useMemo(() => {
    return Math.max(1, ...data.departamentos.map((d) => d.total));
  }, [data]);

  // Color de calor del departamento
  const getColor = (total: number, isSelected: boolean) => {
    if (isSelected) return '#5ae280'; // Verde eléctrico de selección
    if (total === 0) return 'rgba(150, 160, 180, 0.12)';
    const ratio = total / maxCasos;
    if (ratio > 0.6) return '#059669'; // Verde esmeralda intenso
    if (ratio > 0.25) return '#10b981'; // Verde medio
    if (ratio > 0.08) return '#34d399'; // Verde claro
    return '#6ee7b7'; // Verde suave
  };

  const itemSeleccionado = useMemo(() => {
    if (!deptoSeleccionado) return null;
    return data.departamentos.find((d) => d.departamento.toLowerCase() === deptoSeleccionado.toLowerCase()) ?? null;
  }, [data, deptoSeleccionado]);

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Columna Izquierda: Mapa Interactivo SVG */}
      <div className="relative flex flex-col items-center justify-center rounded-3xl glass p-4 md:p-6 lg:col-span-7 xl:col-span-7 min-h-[500px]">
        <div className="mb-2 flex w-full items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-tinta">
            <MapPin className="h-4 w-4 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
            <span>Mapa Territorial de Colombia</span>
          </div>
          <span className="text-[11px] font-semibold text-tinta/50">
            {data.departamentos.length} departamentos con presencia
          </span>
        </div>

        <div className="relative w-full max-w-[520px] aspect-[4/5] flex items-center justify-center">
          <svg
            viewBox="110 15 480 735"
            className="h-full w-full drop-shadow-md select-none"
          >
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {COLOMBIA_DEPTOS.map((dep) => {
              const item = deptoMap.get(dep.nombre.toLowerCase());
              const total = item?.total ?? 0;
              const isSelected = deptoSeleccionado?.toLowerCase() === dep.nombre.toLowerCase();
              const fill = getColor(total, isSelected);

              return (
                <g key={dep.id}>
                  <path
                    d={dep.d}
                    fill={fill}
                    stroke={isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.35)'}
                    strokeWidth={isSelected ? 3 : 1}
                    className="cursor-pointer transition-all duration-200 hover:opacity-85 hover:stroke-white hover:stroke-[2]"
                    filter={isSelected ? 'url(#glow)' : undefined}
                    onClick={() => {
                      onSelectDepto(isSelected ? null : dep.nombre);
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHovered({
                        depto: dep.nombre,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 10,
                      });
                    }}
                    onMouseLeave={() => setHovered(null)}
                  />
                  {total > 0 && (
                    <text
                      x={dep.cx}
                      y={dep.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none fill-slate-900 text-[10px] font-black tracking-tighter drop-shadow dark:fill-white"
                    >
                      {total > 999 ? `${Math.round(total / 100) / 10}k` : total}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip flotante al pasar el cursor */}
          {hovered && (
            <div
              className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-2xl border border-white/20 bg-[#0c102a]/95 p-3 text-xs text-white shadow-2xl backdrop-blur-xl"
              style={{ left: hovered.x, top: hovered.y }}
            >
              {(() => {
                const item = deptoMap.get(hovered.depto.toLowerCase());
                const total = item?.total ?? 0;
                const pct = data.totalNacional > 0 ? ((total / data.totalNacional) * 100).toFixed(1) : '0';
                return (
                  <div className="space-y-1">
                    <p className="font-extrabold text-sm text-xuma-verde-claro">{hovered.depto}</p>
                    <p className="text-slate-300">
                      <span className="font-bold text-white">{formatNum(total)}</span> siniestros ({pct}%)
                    </p>
                    {item && item.totalPagado > 0 && (
                      <p className="text-[11px] text-emerald-400 font-semibold">
                        Pagado: {formatCOP(item.totalPagado)}
                      </p>
                    )}
                    {item && (
                      <div className="flex gap-2 text-[10px] text-slate-400 pt-0.5 border-t border-white/10">
                        <span>Pag: {item.pagados}</span>
                        <span>Trám: {item.enTramite}</span>
                        <span>Obj: {item.objetados}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Leyenda de escala de calor */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium text-tinta/70">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#6ee7b7]" /> Menor
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" /> Medio
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" /> Mayor concentración
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#5ae280]" /> Seleccionado
          </span>
        </div>
      </div>

      {/* Columna Derecha: Detalle del Departamento o Ranking Nacional */}
      <div className="flex flex-col gap-4 lg:col-span-5 xl:col-span-5">
        <AnimatePresence mode="wait">
          {itemSeleccionado ? (
            /* Vista del Departamento Seleccionado con Municipios */
            <motion.div
              key={itemSeleccionado.departamento}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex h-full flex-col rounded-3xl glass p-5 md:p-6"
            >
              <div className="mb-4 flex items-center justify-between border-b border-tinta/10 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-tinta/50">Departamento</span>
                  <h3 className="text-xl font-extrabold text-tinta">{itemSeleccionado.departamento}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectDepto(null)}
                  className="flex items-center gap-1 rounded-xl border border-tinta/15 bg-tinta/5 px-2.5 py-1.5 text-xs font-semibold text-tinta/70 transition-colors hover:bg-tinta/10"
                >
                  <X className="h-3.5 w-3.5" /> Cerrar
                </button>
              </div>

              {/* Estadísticas del departamento */}
              <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl bg-tinta/5 p-3">
                  <span className="text-[10px] font-semibold text-tinta/60">Total siniestros</span>
                  <p className="mt-1 text-lg font-black text-tinta">{formatNum(itemSeleccionado.total)}</p>
                  <span className="text-[10px] text-tinta/50">
                    {data.totalNacional > 0
                      ? `${((itemSeleccionado.total / data.totalNacional) * 100).toFixed(1)}% nacional`
                      : ''}
                  </span>
                </div>
                <div className="rounded-2xl bg-emerald-500/10 p-3">
                  <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">Total pagado</span>
                  <p className="mt-1 text-base font-black text-emerald-800 dark:text-xuma-verde-claro">
                    {formatCOP(itemSeleccionado.totalPagado)}
                  </p>
                </div>
              </div>

              {/* Estados en este departamento */}
              <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">Pagados</span>
                  <p className="font-extrabold text-tinta">{formatNum(itemSeleccionado.pagados)}</p>
                </div>
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-2">
                  <span className="text-[10px] text-sky-700 dark:text-sky-400 font-bold">En trámite</span>
                  <p className="font-extrabold text-tinta">{formatNum(itemSeleccionado.enTramite)}</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-2">
                  <span className="text-[10px] text-red-700 dark:text-red-400 font-bold">Objetados</span>
                  <p className="font-extrabold text-tinta">{formatNum(itemSeleccionado.objetados)}</p>
                </div>
              </div>

              {/* Lista de Municipios / Localidades */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-tinta/80">
                  <Building2 className="h-3.5 w-3.5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
                  Municipios y Localidades ({itemSeleccionado.municipios.length})
                </h4>

                <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 max-h-[280px]">
                  {itemSeleccionado.municipios.map((mun, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl border border-tinta/10 bg-tinta/[0.02] px-3 py-2 text-xs transition-colors hover:bg-tinta/[0.05]"
                    >
                      <span className="font-semibold text-tinta/90">{mun.municipio}</span>
                      <div className="text-right">
                        <span className="font-bold text-tinta">{formatNum(mun.total)}</span>
                        {mun.pagado > 0 && (
                          <span className="block text-[10px] text-emerald-800 dark:text-xuma-verde-claro font-semibold">
                            {formatCOP(mun.pagado)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Ranking General de Departamentos */
            <motion.div
              key="ranking"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex h-full flex-col rounded-3xl glass p-5 md:p-6"
            >
              <div className="mb-3 border-b border-tinta/10 pb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-tinta/50">Concentración territorial</span>
                <h3 className="text-lg font-extrabold text-tinta">Ranking de Departamentos</h3>
                <p className="text-xs text-tinta/60">Haz clic en cualquier departamento para ver sus municipios.</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 space-y-2 max-h-[460px]">
                {data.departamentos.map((dept, i) => {
                  const pct = data.totalNacional > 0 ? ((dept.total / data.totalNacional) * 100).toFixed(1) : '0';
                  return (
                    <button
                      key={dept.departamento}
                      type="button"
                      onClick={() => onSelectDepto(dept.departamento)}
                      className="w-full text-left rounded-2xl border border-tinta/10 bg-tinta/[0.02] p-3 text-xs transition-all hover:border-xuma-verde-claro/50 hover:bg-tinta/[0.06] group"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-tinta/10 text-[10px] font-black text-tinta">
                            {i + 1}
                          </span>
                          <span className="font-bold text-tinta group-hover:text-xuma-verde-oscuro dark:group-hover:text-xuma-verde-claro">
                            {dept.departamento}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-tinta">{formatNum(dept.total)}</span>
                          <span className="text-[10px] text-tinta/50">({pct}%)</span>
                          <ChevronRight className="h-3.5 w-3.5 text-tinta/40 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="h-1.5 w-full rounded-full bg-tinta/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 dark:bg-xuma-verde-claro transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, (dept.total / maxCasos) * 100))}%` }}
                        />
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-tinta/60">
                        <span>{dept.municipios.length} municipios/zonas</span>
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">
                          {formatCOP(dept.totalPagado)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
