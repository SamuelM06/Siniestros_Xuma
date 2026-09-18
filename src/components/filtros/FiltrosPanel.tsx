import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, CalendarRange, CheckCircle2, Fuel, IdCard, Package, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Filters, Metadatos } from '../../lib/types';
import { formatNum, mesLabel, todayISO } from '../../utils/formatters';
import SelectXuma from '../ui/SelectXuma';

interface Props {
  filtros: Filters;
  metadatos: Metadatos;
  onChange: (cambio: Partial<Filters>) => void;
  onReset: () => void;
  activos: number;
  cargando?: boolean;
}

const inputCls =
  'w-full min-w-0 rounded-xl border border-tinta/15 bg-tinta/5 px-3 py-2 text-sm text-tinta placeholder-tinta/35 outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-tinta/10';

const etiquetaCls = 'mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-tinta/60 uppercase';

// Normaliza fechas que pueden llegar como string ISO o como Date (props del island).
function aISO(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return String(v).slice(0, 10);
}

// Tipos de los meses disponibles según el rango real de los datos.
function mesesDisponibles(minRaw: string | Date | null, maxRaw: string | Date | null): { valor: string; etiqueta: string }[] {
  const min = aISO(minRaw);
  const max = aISO(maxRaw);
  if (!min || !max) return [];
  const inicio = min.slice(0, 7);
  const fin = max.slice(0, 7);
  const lista: { valor: string; etiqueta: string }[] = [];
  let y = Number(inicio.split('-')[0] ?? 1);
  let m = Number(inicio.split('-')[1] ?? 1);
  const yFin = Number(fin.split('-')[0] ?? 1);
  const mFin = Number(fin.split('-')[1] ?? 1);
  while (y < yFin || (y === yFin && m <= mFin)) {
    const valor = `${y}-${String(m).padStart(2, '0')}`;
    lista.push({ valor, etiqueta: mesLabel(valor) });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return lista;
}

// Panel de filtros con debounce en el input de contrato.
export default function FiltrosPanel({ filtros, metadatos, onChange, onReset, activos, cargando = false }: Props) {
  const [texto, setTexto] = useState(filtros.contrato ?? '');
  const hoy = useMemo(() => todayISO(), []);

  const meses = useMemo(() => mesesDisponibles(metadatos.rangoFechas.min, metadatos.rangoFechas.max), [metadatos.rangoFechas.min, metadatos.rangoFechas.max]);
  const gaseras = useMemo(() => metadatos.gaseras.map((g) => ({ valor: g, etiqueta: g })), [metadatos.gaseras]);
  const productos = useMemo(() => metadatos.productos.map((p) => ({ valor: p, etiqueta: p })), [metadatos.productos]);
  const estados = useMemo(
    () => metadatos.estados.map((e) => ({ valor: e.estado, etiqueta: `${e.estado} (${formatNum(e.total)})` })),
    [metadatos.estados],
  );

  const elegirMes = useCallback((v: string) => {
    onChange({ mes: v || undefined, desde: undefined, hasta: undefined });
  }, [onChange]);

  const elegirGasera = useCallback((v: string) => {
    onChange({ gasera: v || undefined });
  }, [onChange]);

  const elegirProducto = useCallback((v: string) => {
    onChange({ producto: v || undefined });
  }, [onChange]);

  const elegirEstado = useCallback((v: string) => {
    onChange({ estado: v || undefined });
  }, [onChange]);

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
      className="glass rounded-3xl p-3.5 md:p-4"
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-tinta">
          <SlidersHorizontal className="h-4 w-4 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
          Filtros del reporte
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
            onClick={() => { setTexto(''); onReset(); }}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-tinta/15 px-3.5 py-1.5 text-xs font-semibold text-tinta/70 transition-colors hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restablecer (2026)
          </button>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="block sm:col-span-2 lg:col-span-1 xl:col-span-2">
          <span className={etiquetaCls}><IdCard className="h-3.5 w-3.5" /> Contrato / Cédula</span>
          <input
            type="text"
            className={inputCls}
            placeholder="Buscar por contrato o cédula…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={80}
          />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
          <label className="block min-w-0">
            <span className={etiquetaCls}><CalendarDays className="h-3.5 w-3.5" /> Desde</span>
            <input
              type="date"
              className={inputCls}
              max={hoy}
              value={filtros.desde ?? ''}
              onChange={(e) => onChange({ desde: e.target.value || undefined, mes: undefined })}
            />
          </label>
          <label className="block min-w-0">
            <span className={etiquetaCls}>Hasta</span>
            <input
              type="date"
              className={inputCls}
              max={hoy}
              value={filtros.hasta ?? ''}
              onChange={(e) => onChange({ hasta: e.target.value || undefined, mes: undefined })}
            />
          </label>
        </div>

        <label className="block min-w-0">
          <span className={etiquetaCls}><CalendarRange className="h-3.5 w-3.5" /> Mes</span>
          <SelectXuma
            valor={filtros.mes ?? ''}
            opciones={meses}
            alCambiar={elegirMes}
            placeholder="Filtrar por mes"
            etiquetaTodo="Todos los meses"
            icono={<CalendarRange className="h-4 w-4" />}
          />
        </label>

        <label className="block min-w-0">
          <span className={etiquetaCls}><Fuel className="h-3.5 w-3.5" /> Gasera</span>
          <SelectXuma
            valor={filtros.gasera ?? ''}
            opciones={gaseras}
            alCambiar={elegirGasera}
            placeholder="Filtrar por gasera"
            etiquetaTodo="Todas las gaseras"
            icono={<Fuel className="h-4 w-4" />}
          />
        </label>

        <label className="block min-w-0 sm:col-span-2 lg:col-span-1 xl:col-span-3">
          <span className={etiquetaCls}><Package className="h-3.5 w-3.5" /> Producto</span>
          <SelectXuma
            valor={filtros.producto ?? ''}
            opciones={productos}
            alCambiar={elegirProducto}
            placeholder="Filtrar por producto"
            etiquetaTodo="Todos los productos"
            icono={<Package className="h-4 w-4" />}
          />
        </label>

        <label className="block min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-3">
          <span className={etiquetaCls}><CheckCircle2 className="h-3.5 w-3.5" /> Estado del siniestro</span>
          <SelectXuma
            valor={filtros.estado ?? ''}
            opciones={estados}
            alCambiar={elegirEstado}
            placeholder="Filtrar por estado"
            etiquetaTodo="Todos los estados"
            icono={<CheckCircle2 className="h-4 w-4" />}
          />
        </label>
      </div>
    </motion.section>
  );
}