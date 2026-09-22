import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Activity, CalendarRange, Fuel, Landmark, Package, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { EstatusData, Metadatos } from '../../lib/types';
import { formatNum } from '../../utils/formatters';
import SelectXuma from '../ui/SelectXuma';

interface Props {
  metadatos: Metadatos;
  anioInicial: number;
  datosIniciales?: EstatusData;
}

const ANIO_POR_DEFECTO = 2026;
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface FiltrosEstatus {
  anio: number;
  gasera?: string;
  estado?: string;
  producto?: string;
  aseguradora?: string;
}

const inputSelectCls = 'w-full min-w-0';

const etiquetaCls = 'mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-tinta/60 uppercase';

function construirQs(f: FiltrosEstatus): string {
  const p = new URLSearchParams({ anio: String(f.anio) });
  if (f.gasera) p.set('gasera', f.gasera);
  if (f.estado) p.set('estado', f.estado);
  if (f.producto) p.set('producto', f.producto);
  if (f.aseguradora) p.set('aseguradora', f.aseguradora);
  return p.toString();
}

// Matriz de estatus de siniestros: filas = gaseras, columnas = meses del año,
// con total por gasera, por mes y total general.
export default function EstatusApp({ metadatos, anioInicial, datosIniciales }: Props) {
  const [filtros, setFiltros] = useState<FiltrosEstatus>({ anio: anioInicial });
  const [data, setData] = useState<EstatusData | null>(datosIniciales ?? null);
  const [cargando, setCargando] = useState(datosIniciales == null);
  const [error, setError] = useState('');
  const primeraCarga = useRef(datosIniciales != null);

  const anios = useMemo(() => metadatos.anios.map((a) => ({ valor: String(a), etiqueta: String(a) })), [metadatos.anios]);
  const gaseras = useMemo(() => metadatos.gaseras.map((g) => ({ valor: g, etiqueta: g })), [metadatos.gaseras]);
  const estados = useMemo(() => metadatos.estados.map((e) => ({ valor: e.estado, etiqueta: `${e.estado} (${formatNum(e.total)})` })), [metadatos.estados]);
  const productos = useMemo(() => metadatos.productos.map((p) => ({ valor: p, etiqueta: p })), [metadatos.productos]);
  const aseguradoras = useMemo(() => metadatos.aseguradoras.map((a) => ({ valor: a, etiqueta: a })), [metadatos.aseguradoras]);

  const cambiar = useCallback((cambio: Partial<FiltrosEstatus>) => {
    setFiltros((prev) => ({ ...prev, ...cambio }));
  }, []);

  const reset = useCallback(() => {
    setFiltros({ anio: anioInicial });
  }, [anioInicial]);

  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      setCargando(false);
      return;
    }
    let vivo = true;
    setCargando(true);
    setError('');
    fetch(`/api/estatus?${construirQs(filtros)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return (await res.json()) as EstatusData;
      })
      .then((d) => {
        if (!vivo) return;
        setData(d);
      })
      .catch(() => {
        if (vivo) setError('No se pudo cargar el estatus de siniestros.');
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [filtros]);

  const matriz = useMemo(() => {
    if (!data) return null;
    const mapa = new Map<string, number[]>();
    for (const g of data.gaseras) mapa.set(g, Array.from({ length: 12 }, () => 0));
    for (const f of data.filas) {
      const fila = mapa.get(f.gasera);
      if (fila) {
        const idx = (f.mes - 1) % 12;
        fila[idx] = (fila[idx] ?? 0) + f.total;
      }
    }
    const filas = data.gaseras.map((g) => ({
      gasera: g,
      meses: mapa.get(g) ?? Array.from({ length: 12 }, () => 0),
      total: (mapa.get(g) ?? []).reduce((s, n) => s + n, 0),
    }));
    const totalesMes = Array.from({ length: 12 }, (_, i) => filas.reduce((s, f) => s + (f.meses[i] ?? 0), 0));
    const totalGeneral = totalesMes.reduce((s, n) => s + n, 0);
    return { filas, totalesMes, totalGeneral };
  }, [data]);

  const maxCelda = matriz ? Math.max(1, ...matriz.filas.flatMap((f) => f.meses)) : 1;

  // Solo se muestran los meses ya transcurridos del año en curso (Ene…mes actual);
  // los años completos (ej. 2025) muestran sus 12 meses.
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1;
  const mesesVisibles = filtros.anio === anioActual ? MESES_CORTOS.slice(0, mesActual) : MESES_CORTOS;

  const activos =
    (filtros.gasera ? 1 : 0) +
    (filtros.estado ? 1 : 0) +
    (filtros.producto ? 1 : 0) +
    (filtros.aseguradora ? 1 : 0) +
    (filtros.anio !== anioInicial ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Filtros: Año, Producto, Estado y Aseguradora */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="glass relative z-20 rounded-3xl p-3"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-tinta">
            <SlidersHorizontal className="h-4 w-4 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
            Filtros del estatus
          </h2>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {cargando && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1.5 rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-2.5 py-0.5 text-[11px] font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro"
                >
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  Actualizando…
                </motion.span>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {activos > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-2.5 py-0.5 text-[11px] font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro"
                >
                  {activos} filtro{activos > 1 ? 's' : ''} activo{activos > 1 ? 's' : ''}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={reset}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-tinta/15 px-3.5 py-1.5 text-xs font-semibold text-tinta/70 transition-colors hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer ({ANIO_POR_DEFECTO})
            </button>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block min-w-0">
            <span className={etiquetaCls}><CalendarRange className="h-3.5 w-3.5" /> Año</span>
            <SelectXuma
              valor={String(filtros.anio)}
              opciones={anios}
              alCambiar={(v) => cambiar({ anio: Number(v) || ANIO_POR_DEFECTO })}
              placeholder="Seleccionar año"
              etiquetaTodo={`Todos los años`}
              icono={<CalendarRange className="h-4 w-4" />}
              desplegableClase={inputSelectCls}
            />
          </label>

          <label className="block min-w-0">
            <span className={etiquetaCls}><Fuel className="h-3.5 w-3.5" /> Gasera</span>
            <SelectXuma
              valor={filtros.gasera ?? ''}
              opciones={gaseras}
              alCambiar={(v) => cambiar({ gasera: v || undefined })}
              placeholder="Filtrar por gasera"
              etiquetaTodo="Todas las gaseras"
              icono={<Fuel className="h-4 w-4" />}
              desplegableClase="w-max min-w-72 max-w-[85vw] right-0"
            />
          </label>

          <label className="block min-w-0">
            <span className={etiquetaCls}><Package className="h-3.5 w-3.5" /> Producto</span>
            <SelectXuma
              valor={filtros.producto ?? ''}
              opciones={productos}
              alCambiar={(v) => cambiar({ producto: v || undefined })}
              placeholder="Filtrar por producto"
              etiquetaTodo="Todos los productos"
              icono={<Package className="h-4 w-4" />}
              desplegableClase="w-max min-w-72 max-w-[85vw] right-0"
            />
          </label>

          <label className="block min-w-0">
            <span className={etiquetaCls}><Activity className="h-3.5 w-3.5" /> Estado</span>
            <SelectXuma
              valor={filtros.estado ?? ''}
              opciones={estados}
              alCambiar={(v) => cambiar({ estado: v || undefined })}
              placeholder="Filtrar por estado"
              etiquetaTodo="Todos los estados"
              icono={<Activity className="h-4 w-4" />}
              desplegableClase="w-max min-w-72 max-w-[85vw] right-0"
            />
          </label>

          <label className="block min-w-0">
            <span className={etiquetaCls}><Landmark className="h-3.5 w-3.5" /> Aseguradora</span>
            <SelectXuma
              valor={filtros.aseguradora ?? ''}
              opciones={aseguradoras}
              alCambiar={(v) => cambiar({ aseguradora: v || undefined })}
              placeholder="Filtrar por aseguradora"
              etiquetaTodo="Todas las aseguradoras"
              icono={<Landmark className="h-4 w-4" />}
              desplegableClase="w-max min-w-72 max-w-[85vw] right-0"
            />
          </label>
        </div>
      </motion.section>

      {/* Tabla matriz: gasera × mes */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="glass rounded-3xl p-5 md:p-6"
      >
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-bold text-tinta md:text-lg">
            <Fuel className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
            Siniestros por gasera y mes
          </h2>
          <div className="flex items-center gap-3">
            {matriz && (
              <span className="rounded-full bg-tinta/10 px-3 py-1 text-xs font-semibold text-tinta/70">
                {cargando ? (
                  <span className="inline-flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Actualizando…
                  </span>
                ) : (
                  `${formatNum(matriz.totalGeneral)} siniestros en ${filtros.anio} · ${matriz.filas.length} gasera${matriz.filas.length === 1 ? '' : 's'}`
                )}
              </span>
            )}
          </div>
        </header>

        {error && (
          <p className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl">
          <table
            aria-busy={cargando}
            className={`w-full min-w-[860px] border-collapse text-sm transition-opacity ${cargando && data ? 'opacity-60' : ''}`}
          >
            <thead>
              <tr className="text-left text-xs tracking-wide text-tinta/55 uppercase">
                <th className="sticky left-0 z-10 bg-transparent py-3 pr-4 font-semibold">
                  Gasera
                </th>
                {mesesVisibles.map((m) => (
                  <th key={m} className="px-2 py-3 text-center font-semibold">{m}</th>
                ))}
                <th className="px-3 py-3 text-center font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro">Total</th>
              </tr>
            </thead>
            {cargando && !data ? (
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="py-3 pr-4">
                    <div className="skeleton h-4 w-40" />
                  </td>
                  {Array.from({ length: mesesVisibles.length + 1 }).map((__, j) => (
                    <td key={j} className="px-2 py-3 text-center">
                      <div className="skeleton mx-auto h-4 w-8" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : (
            <AnimatePresence initial={false} mode="wait">
              <motion.tbody
                key={`${filtros.anio}:${filtros.gasera ?? ''}:${filtros.estado ?? ''}:${filtros.producto ?? ''}:${filtros.aseguradora ?? ''}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                {matriz && matriz.filas.length > 0 ? (
                  matriz.filas.map((fila) => (
                    <tr
                      key={fila.gasera}
                      className="border-t border-tinta/5 transition-colors hover:bg-tinta/5"
                    >
                      <td className="sticky left-0 z-10 border-t border-tinta/5 bg-transparent py-3 pr-4 font-semibold whitespace-nowrap text-tinta/90 backdrop-blur-xl">
                        <span className="flex items-center gap-2">
                          <Fuel className="h-3.5 w-3.5 shrink-0 text-tinta/40" />
                          {fila.gasera}
                        </span>
                      </td>
                      {fila.meses.slice(0, mesesVisibles.length).map((n, j) => {
                        const ratio = n > 0 ? Math.sqrt(n / maxCelda) : 0;
                        const mes = mesesVisibles[j] ?? '';
                        return (
                          <td
                            key={j}
                            className="px-2 py-3 text-center tabular text-tinta/80"
                            style={{
                              background: n > 0 ? `color-mix(in srgb, var(--cgraf-2) ${Math.round(ratio * 38)}%, transparent)` : undefined,
                            }}
                            title={`${fila.gasera} · ${mes}: ${formatNum(n)}`}
                          >
                            <span className={n === 0 ? 'text-tinta/25' : 'font-semibold'}>{n === 0 ? '·' : formatNum(n)}</span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-center font-bold text-xuma-verde-oscuro tabular dark:text-xuma-verde-claro">
                        {formatNum(fila.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={mesesVisibles.length + 2} className="py-12 text-center text-tinta/50">
                      <span className="mx-auto mb-2 block h-10 w-10 text-tinta-dim">
                        <CalendarRange className="h-10 w-10" />
                      </span>
                      <p className="mt-2">No hay siniestros que coincidan con los filtros.</p>
                    </td>
                  </tr>
                )}
              </motion.tbody>
            </AnimatePresence>
          )}
            {matriz && matriz.filas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-xuma-verde-claro/40 text-xs font-bold text-tinta">
                  <td className="sticky left-0 z-10 py-3 pr-4 text-base uppercase tracking-wide text-tinta/70">
                    Total
                  </td>
                  {matriz.totalesMes.slice(0, mesesVisibles.length).map((n, j) => (
                    <td key={j} className="px-2 py-3 text-center tabular font-bold text-tinta/90">
                      {n > 0 ? formatNum(n) : '·'}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-center font-black text-xuma-verde-oscuro tabular dark:text-xuma-verde-claro">
                    {formatNum(matriz.totalGeneral)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {matriz && matriz.filas.length > 0 && (
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-tinta/60">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--cgraf-2)', opacity: 0.35 }} />
              Intensidad = volumen de siniestros del mes
            </span>
            <span>Total pagado no aplica a esta vista (solo conteo de siniestros).</span>
          </p>
        )}
      </motion.section>
    </div>
  );
}