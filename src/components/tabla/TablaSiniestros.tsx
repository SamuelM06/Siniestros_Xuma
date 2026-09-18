import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Download, FileSearch, FileSpreadsheet, Table2, Upload, X } from 'lucide-react';
import type { Filters, PaginaTabla, RegistroTabla } from '../../lib/types';
import { formatCOP, formatFecha, formatNum } from '../../utils/formatters';
import { queryString } from '../../utils/fetcher';
import { descargarExcel } from '../../utils/excel';
import { estadoColorCat } from '../../lib/normalizacion';

interface Props {
  filtros: Filters;
}

const ESTADO_STYLE: Record<string, string> = {
  verde: 'bg-emerald-100/80 text-emerald-800 border-emerald-300/80 dark:bg-xuma-verde-claro/15 dark:text-xuma-verde-claro dark:border-xuma-verde-claro/40',
  rojo: 'bg-red-500/15 text-red-700 border-red-300/70 dark:text-red-300 dark:border-red-400/40',
  ambar: 'bg-amber-400/15 text-amber-800 border-amber-300/70 dark:text-amber-300 dark:border-amber-300/40',
  azul: 'bg-sky-400/15 text-sky-800 border-sky-300/70 dark:text-sky-300 dark:border-sky-300/40',
  cyan: 'bg-cyan-300/15 text-cyan-800 border-cyan-300/70 dark:text-cyan-200 dark:border-cyan-300/40',
  morado: 'bg-violet-400/15 text-violet-800 border-violet-300/70 dark:text-violet-300 dark:border-violet-300/40',
  gris: 'bg-tinta/10 text-tinta/75 border-tinta/20',
};

type ModoExport = 'pagina' | 'rango' | 'todo';

// Trae todas las filas del rango de páginas indicado (páginas de la vista actual).
async function obtenerPaginas(q: string, desdePag: number, hastaPag: number, tamano: number): Promise<RegistroTabla[]> {
  const filas: RegistroTabla[] = [];
  const tope = Math.min(hastaPag, 2000);
  for (let p = desdePag; p <= tope; p++) {
    const res = await fetch(`/api/tabla?${q}&page=${p}&size=${tamano}`);
    if (!res.ok) throw new Error('No autorizado o error de servidor');
    const d = (await res.json()) as PaginaTabla;
    filas.push(...d.registros);
    if (d.registros.length === 0) break;
  }
  return filas;
}

// Tabla de detalle paginada, animada y exportable a Excel.
export default function TablaSiniestros({ filtros }: Props) {
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(15);
  const [data, setData] = useState<PaginaTabla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoExport, setModoExport] = useState<ModoExport>('todo');
  const [rangoDesde, setRangoDesde] = useState(1);
  const [rangoHasta, setRangoHasta] = useState(1);
  const [exportando, setExportando] = useState(false);
  const [errorExport, setErrorExport] = useState('');

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError('');
    const q = queryString(filtros);
    fetch(`/api/tabla?${q}&page=${pagina}&size=${tamano}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('No autorizado o error de servidor');
        return (await res.json()) as PaginaTabla;
      })
      .then((d) => {
        if (!cancelado) setData(d);
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar la tabla.');
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [filtros, pagina, tamano]);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const mostrando = data ? Math.min(data.pageSize, data.total) : 0;

  const abrirExportar = () => {
    setRangoDesde(1);
    setRangoHasta(totalPaginas);
    setModoExport('todo');
    setErrorExport('');
    setModalAbierto(true);
  };

  const descargar = async () => {
    if (!data) return;
    setExportando(true);
    setErrorExport('');
    try {
      const q = queryString(filtros);
      let desde = 1;
      let hasta = totalPaginas;
      let extra = '_total';
      if (modoExport === 'pagina') {
        desde = pagina;
        hasta = pagina;
        extra = `_pagina${pagina}`;
      } else if (modoExport === 'rango') {
        const d = Math.max(1, Math.min(rangoDesde, totalPaginas));
        const h = Math.max(d, Math.min(rangoHasta, totalPaginas));
        desde = d;
        hasta = h;
        extra = h === d ? `_pagina${d}` : `_paginas${d}_a_${h}`;
      }
      const filas = await obtenerPaginas(q, desde, hasta, tamano);
      if (filas.length === 0) throw new Error('No hay registros para exportar.');
      await descargarExcel(filas, extra);
      setModalAbierto(false);
    } catch {
      setErrorExport('No se pudo exportar. Intente nuevamente.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-3xl p-5 md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-tinta md:text-lg">
          <Table2 className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
          Detalle de siniestros
        </h2>
        <div className="flex items-center gap-3">
          {data && !cargando && (
            <span className="rounded-full bg-tinta/10 px-3 py-1 text-xs font-semibold text-tinta/70">
              {formatNum(data.total)} registro{data.total === 1 ? '' : 's'} · mostrando {formatNum(mostrando)}
            </span>
          )}
          <button
            type="button"
            onClick={abrirExportar}
            disabled={!data || data.total === 0 || cargando}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-600/10 px-3.5 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-xuma-verde-claro/40 dark:bg-xuma-verde-claro/10 dark:text-xuma-verde-claro dark:hover:bg-xuma-verde-claro/20"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Excel
          </button>
        </div>
      </header>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-tinta/15 bg-white/40 dark:bg-transparent">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead className="border-b border-tinta/15 bg-slate-200/90 dark:bg-white/[0.06]">
            <tr className="text-left text-[11px] font-extrabold tracking-wider text-slate-800 uppercase dark:text-slate-200">
              <th className="py-3.5 pr-4 pl-4">Contrato</th>
              <th className="py-3.5 pr-4">Asegurado</th>
              <th className="py-3.5 pr-4">Aseguradora</th>
              <th className="py-3.5 pr-4">Gasera</th>
              <th className="py-3.5 pr-4">Producto</th>
              <th className="py-3.5 pr-4">Estado</th>
              <th className="py-3.5 pr-4">Radicación</th>
              <th className="py-3.5 pr-4 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="skeleton h-4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data && data.registros.length > 0 ? (
              <AnimatePresence initial={false} mode="popLayout">
                {data.registros.map((r, i) => {
                  const cat = estadoColorCat(r.estado);
                  return (
                    <motion.tr
                      key={r.id_caso}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
                      className="border-t border-tinta/10 transition-colors hover:bg-tinta/[0.04]"
                    >
                      <td className="py-3.5 pr-4 pl-4 font-bold text-tinta">{r.numero_contrato ?? '—'}</td>
                      <td className="py-3.5 pr-4 font-medium text-tinta/90">{r.nombre_asegurado ?? '—'}</td>
                      <td className="py-3.5 pr-4 text-tinta/80">{r.aseguradora}</td>
                      <td className="py-3.5 pr-4 text-tinta/80">{r.gasera}</td>
                      <td className="max-w-[180px] truncate py-3.5 pr-4 font-semibold text-tinta/90" title={r.producto}>{r.producto}</td>
                      <td className="py-3.5 pr-4">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${ESTADO_STYLE[cat] ?? ESTADO_STYLE.gris}`}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3.5 pr-4 text-xs text-tinta/75">{formatFecha(r.fecha_radicacion)}</td>
                      <td className="py-3.5 pr-4 text-right font-bold text-emerald-800 tabular dark:text-xuma-verde-claro">
                        {r.monto != null ? formatCOP(r.monto) : '—'}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            ) : (
              <tr>
                <td colSpan={8} className="py-12 text-center text-tinta/50">
                  <FileSearch className="mx-auto mb-2 h-10 w-10 text-tinta-dim" />
                  <p className="mt-2">No hay siniestros que coincidan con los filtros.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-tinta/10 pt-4">
          <div className="flex items-center gap-2 text-sm text-tinta/60">
            <span>Filas por página</span>
            <select
              className="cursor-pointer rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-1.5 text-sm text-tinta outline-none focus:border-xuma-verde-claro/60 [&>option]:text-[#141a3d]"
              value={tamano}
              onChange={(e) => {
                setTamano(Number(e.target.value));
                setPagina(1);
              }}
            >
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1 || cargando}
              className="cursor-pointer rounded-xl border border-tinta/15 px-3.5 py-2 text-sm font-semibold text-tinta/75 transition-colors hover:bg-tinta/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="px-2 text-sm text-tinta/70">
              Página <b className="text-tinta">{pagina}</b> de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas || cargando}
              className="cursor-pointer rounded-xl border border-tinta/15 px-3.5 py-2 text-sm font-semibold text-tinta/75 transition-colors hover:bg-tinta/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </footer>
      )}

      {/* Modal de exportación */}
      <AnimatePresence>
        {modalAbierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,10,31,0.55)] p-4 backdrop-blur-sm"
            onClick={() => { if (!exportando) setModalAbierto(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 22, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 22, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-md rounded-3xl p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Exportar a Excel"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold text-tinta">
                    <FileSpreadsheet className="h-5 w-5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
                    Exportar a Excel
                  </h3>
                  <p className="mt-1 text-xs text-tinta/60">
                    {formatNum(data?.total ?? 0)} registros coinciden con los filtros. Elige qué páginas incluir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  disabled={exportando}
                  className="cursor-pointer rounded-lg p-1.5 text-tinta/60 transition-colors hover:bg-tinta/10 hover:text-tinta disabled:opacity-40"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-colors ${modoExport === 'todo' ? 'border-xuma-verde-claro/50 bg-xuma-verde-claro/10' : 'border-tinta/15 hover:bg-tinta/5'}`}>
                  <input
                    type="radio"
                    name="export"
                    checked={modoExport === 'todo'}
                    onChange={() => setModoExport('todo')}
                    className="accent-xuma-verde-oscuro dark:accent-xuma-verde-claro"
                  />
                  <span className="text-sm font-semibold text-tinta">
                    Todo
                    <span className="block text-xs font-normal text-tinta/60">{formatNum(data?.total ?? 0)} registros · {formatNum(totalPaginas)} páginas</span>
                  </span>
                </label>

                <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-colors ${modoExport === 'pagina' ? 'border-xuma-verde-claro/50 bg-xuma-verde-claro/10' : 'border-tinta/15 hover:bg-tinta/5'}`}>
                  <input
                    type="radio"
                    name="export"
                    checked={modoExport === 'pagina'}
                    onChange={() => setModoExport('pagina')}
                    className="accent-xuma-verde-oscuro dark:accent-xuma-verde-claro"
                  />
                  <span className="text-sm font-semibold text-tinta">
                    Página actual
                    <span className="block text-xs font-normal text-tinta/60">Solo los {formatNum(mostrando)} registros visibles de la página {formatNum(pagina)}</span>
                  </span>
                </label>

                <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-colors ${modoExport === 'rango' ? 'border-xuma-verde-claro/50 bg-xuma-verde-claro/10' : 'border-tinta/15 hover:bg-tinta/5'}`}>
                  <input
                    type="radio"
                    name="export"
                    checked={modoExport === 'rango'}
                    onChange={() => setModoExport('rango')}
                    className="accent-xuma-verde-oscuro dark:accent-xuma-verde-claro"
                  />
                  <span className="text-sm font-semibold text-tinta">
                    Rango de páginas
                    <span className="mt-2 block space-x-2">
                      <label className="inline-flex items-center gap-1.5 text-xs font-normal text-tinta/60">
                        Desde
                        <input
                          type="number"
                          min={1}
                          max={totalPaginas}
                          value={rangoDesde}
                          onChange={(e) => setRangoDesde(Number(e.target.value))}
                          disabled={modoExport !== 'rango'}
                          className="w-16 rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-1 text-xs text-tinta outline-none disabled:opacity-40"
                        />
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-normal text-tinta/60">
                        Hasta
                        <input
                          type="number"
                          min={1}
                          max={totalPaginas}
                          value={rangoHasta}
                          onChange={(e) => setRangoHasta(Number(e.target.value))}
                          disabled={modoExport !== 'rango'}
                          className="w-16 rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-1 text-xs text-tinta outline-none disabled:opacity-40"
                        />
                      </label>
                    </span>
                  </span>
                </label>
              </div>

              {errorExport && (
                <p className="mt-3 flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs text-red-200">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {errorExport}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  disabled={exportando}
                  className="cursor-pointer rounded-xl border border-tinta/15 px-4 py-2.5 text-sm font-semibold text-tinta/75 transition-colors hover:bg-tinta/10 disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={descargar}
                  disabled={exportando}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-xuma-verde-claro px-4 py-2.5 text-sm font-bold text-[#0a1030] shadow-lg shadow-xuma-verde-claro/25 transition-colors hover:bg-xuma-verde-oscuro disabled:opacity-60"
                >
                  {exportando ? (
                    <>
                      <Upload className="h-4 w-4 animate-pulse" />
                      Generando…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Descargar Excel
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}