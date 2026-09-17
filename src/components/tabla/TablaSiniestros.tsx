import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Filters, PaginaTabla } from '../../lib/types';
import { formatCOP, formatFecha, formatNum } from '../../utils/formatters';
import { queryString } from '../../utils/fetcher';
import { estadoColorCat } from '../../lib/normalizacion';

interface Props {
  filtros: Filters;
}

const ESTADO_STYLE: Record<string, string> = {
  verde: 'bg-xuma-verde-claro/15 text-xuma-verde-claro border-xuma-verde-claro/40',
  rojo: 'bg-red-500/15 text-red-300 border-red-400/40',
  ambar: 'bg-amber-400/15 text-amber-300 border-amber-300/40',
  azul: 'bg-sky-400/15 text-sky-300 border-sky-300/40',
  cyan: 'bg-cyan-300/15 text-cyan-200 border-cyan-300/40',
  morado: 'bg-violet-400/15 text-violet-300 border-violet-300/40',
  gris: 'bg-white/10 text-white/60 border-white/20',
};

// Tabla de detalle paginada y animada (respeta los filtros activos).
export default function TablaSiniestros({ filtros }: Props) {
  const [pagina, setPagina] = useState(1);
  const [tamano, setTamano] = useState(15);
  const [data, setData] = useState<PaginaTabla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="glass rounded-3xl p-5 md:p-6"
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-white md:text-lg">
          <span>📋</span> Detalle de siniestros
        </h2>
        {data && !cargando && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            {formatNum(data.total)} registro{data.total === 1 ? '' : 's'} · mostrando {formatNum(mostrando)}
          </span>
        )}
      </header>

      {error && <p className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">⚠️ {error}</p>}

      <div className="overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-white/55 uppercase">
              <th className="py-3 pr-4 font-semibold">Contrato</th>
              <th className="py-3 pr-4 font-semibold">Asegurado</th>
              <th className="py-3 pr-4 font-semibold">Aseguradora</th>
              <th className="py-3 pr-4 font-semibold">Gasera</th>
              <th className="py-3 pr-4 font-semibold">Producto</th>
              <th className="py-3 pr-4 font-semibold">Estado</th>
              <th className="py-3 pr-4 font-semibold">Radicación</th>
              <th className="py-3 pr-2 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-2 py-3 last:pr-2 first:pl-0">
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
                      className="border-t border-white/5 transition-colors hover:bg-white/5"
                    >
                      <td className="py-3 pr-4 font-semibold text-white/90">{r.numero_contrato ?? '—'}</td>
                      <td className="py-3 pr-4 text-white/70">{r.nombre_asegurado ?? '—'}</td>
                      <td className="py-3 pr-4 text-white/70">{r.aseguradora}</td>
                      <td className="py-3 pr-4 text-white/70">{r.gasera}</td>
                      <td className="max-w-[180px] truncate py-3 pr-4 text-white/70" title={r.producto}>{r.producto}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${ESTADO_STYLE[cat] ?? ESTADO_STYLE.gris}`}>
                          {r.estado}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-white/60">{formatFecha(r.fecha_radicacion)}</td>
                      <td className="py-3 pr-2 text-right font-semibold text-xuma-verde-claro tabular">
                        {r.monto != null ? formatCOP(r.monto) : '—'}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            ) : (
              <tr>
                <td colSpan={8} className="py-12 text-center text-white/50">
                  <p className="text-3xl">🕵️</p>
                  <p className="mt-2">No hay siniestros que coincidan con los filtros.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>Filas por página</span>
            <select
              className="cursor-pointer rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white outline-none focus:border-xuma-verde-claro/60 [&>option]:text-[#0a1030]"
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
              className="cursor-pointer rounded-xl border border-white/15 px-3.5 py-2 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="px-2 text-sm text-white/70">
              Página <b className="text-white">{pagina}</b> de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina >= totalPaginas || cargando}
              className="cursor-pointer rounded-xl border border-white/15 px-3.5 py-2 text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente →
            </button>
          </div>
        </footer>
      )}
    </motion.section>
  );
}