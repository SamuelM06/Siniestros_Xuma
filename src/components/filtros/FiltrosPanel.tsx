import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Filters, Metadatos } from '../../lib/types';
import { todayISO } from '../../utils/formatters';

interface Props {
  filtros: Filters;
  metadatos: Metadatos;
  onChange: (cambio: Partial<Filters>) => void;
  onReset: () => void;
  activos: number;
}

const inputCls =
  'w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/35 outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-white/10';

const selCls =
  'appearance-none w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-white/10 [&>option]:text-[#0a1030]';

// Panel de filtros con debounce en el input de contrato.
export default function FiltrosPanel({ filtros, metadatos, onChange, onReset, activos }: Props) {
  const [texto, setTexto] = useState(filtros.contrato ?? '');
  const hoy = useMemo(() => todayISO(), []);

  useEffect(() => {
    const id = setTimeout(() => {
      onChange({ contrato: texto.trim() !== '' ? texto.trim() : undefined });
    }, 450);
    return () => clearTimeout(id);
  }, [texto, onChange]);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-white md:text-lg">
          <span>🧭</span> Filtros del reporte
        </h2>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {activos > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-3 py-1 text-xs font-bold text-xuma-verde-claro"
              >
                {activos} filtro{activos > 1 ? 's' : ''} activo{activos > 1 ? 's' : ''}
              </motion.span>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => { setTexto(''); onReset(); }}
            className="cursor-pointer rounded-xl border border-white/15 px-3.5 py-2 text-xs font-semibold text-white/70 transition-colors hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-200"
          >
            ⟲ Restablecer (2026)
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-white/60 uppercase">📇 Contrato</span>
          <input
            type="text"
            className={inputCls}
            placeholder="Buscar por contrato…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={80}
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-white/60 uppercase">📅 Desde</span>
            <input
              type="date"
              className={inputCls}
              max={hoy}
              value={filtros.desde ?? ''}
              onChange={(e) => onChange({ desde: e.target.value || undefined })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold tracking-wide text-white/60 uppercase">Hasta</span>
            <input
              type="date"
              className={inputCls}
              max={hoy}
              value={filtros.hasta ?? ''}
              onChange={(e) => onChange({ hasta: e.target.value || undefined })}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-white/60 uppercase">⛽ Gasera</span>
          <select
            className={selCls}
            value={filtros.gasera ?? ''}
            onChange={(e) => onChange({ gasera: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {metadatos.gaseras.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold tracking-wide text-white/60 uppercase">📦 Producto</span>
          <select
            className={selCls}
            value={filtros.producto ?? ''}
            onChange={(e) => onChange({ producto: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {metadatos.productos.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>
    </motion.section>
  );
}