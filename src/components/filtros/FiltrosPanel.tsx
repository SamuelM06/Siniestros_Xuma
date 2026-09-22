import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { IdCard, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { Filters, Metadatos } from '../../lib/types';
import { formatNum, mesLabel } from '../../utils/formatters';
import SelectXuma from '../ui/SelectXuma';

interface Props {
  filtros: Filters;
  metadatos: Metadatos;
  onChange: (cambio: Partial<Filters>) => void;
  onReset: () => void;
  activos: number;
  cargando?: boolean;
  mostrarTipoSiniestro?: boolean;
}

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

// Panel de filtros en una sola línea horizontal con debounce en el input de contrato.
export default function FiltrosPanel({ filtros, metadatos, onChange, onReset, activos, cargando = false, mostrarTipoSiniestro = false }: Props) {
  const [texto, setTexto] = useState(filtros.contrato ?? '');

  const meses = useMemo(() => mesesDisponibles(metadatos.rangoFechas.min, metadatos.rangoFechas.max), [metadatos.rangoFechas.min, metadatos.rangoFechas.max]);
  const aseguradoras = useMemo(() => (metadatos.aseguradoras ?? []).map((a) => ({ valor: a, etiqueta: a })), [metadatos.aseguradoras]);
  const gaseras = useMemo(() => metadatos.gaseras.map((g) => ({ valor: g, etiqueta: g })), [metadatos.gaseras]);
  const productos = useMemo(() => metadatos.productos.map((p) => ({ valor: p, etiqueta: p })), [metadatos.productos]);
  const estados = useMemo(
    () => metadatos.estados.map((e) => ({ valor: e.estado, etiqueta: `${e.estado} (${formatNum(e.total)})` })),
    [metadatos.estados],
  );
  const tiposSiniestro = useMemo(
    () => (metadatos.tipos_siniestro ?? []).map((t) => ({ valor: t.tipo_siniestro, etiqueta: `${t.tipo_siniestro} (${formatNum(t.total)})` })),
    [metadatos.tipos_siniestro],
  );

  const elegirMes = useCallback((v: string) => {
    onChange({ mes: v || undefined, desde: undefined, hasta: undefined });
  }, [onChange]);

  const elegirAseguradora = useCallback((v: string) => {
    onChange({ aseguradora: v || undefined });
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

  const elegirTipoSiniestro = useCallback((v: string) => {
    onChange({ tipo_siniestro: v || undefined });
  }, [onChange]);

  useEffect(() => {
    const id = setTimeout(() => {
      onChange({ contrato: texto.trim() !== '' ? texto.trim() : undefined });
    }, 450);
    return () => clearTimeout(id);
  }, [texto, onChange]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="glass relative z-20 rounded-2xl px-3 py-2 shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
        {/* Etiqueta / Ícono */}
        <div className="flex items-center gap-1.5 font-bold text-tinta text-xs whitespace-nowrap shrink-0 mr-1">
          <SlidersHorizontal className="h-3.5 w-3.5 text-xuma-verde-oscuro dark:text-xuma-verde-claro" />
          <span>Filtros</span>
        </div>

        {/* Buscador Contrato / Cédula */}
        <div className="relative min-w-[130px] flex-1 sm:max-w-[180px]">
          <input
            type="text"
            className="w-full rounded-lg border border-tinta/15 bg-tinta/5 px-2 py-1.5 pl-6 text-xs text-tinta placeholder-tinta/35 outline-none transition-colors focus:border-xuma-verde-claro/70 focus:bg-tinta/10"
            placeholder="Contrato o cédula…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={80}
          />
          <IdCard className="absolute left-1.5 top-2 h-3.5 w-3.5 text-tinta/40" />
        </div>

        {/* Mes */}
        <div className="min-w-[125px] flex-1">
          <SelectXuma
            valor={filtros.mes ?? ''}
            opciones={meses}
            alCambiar={elegirMes}
            placeholder="Mes"
            etiquetaTodo="Todos los meses"
            compact
          />
        </div>

        {/* Aseguradora */}
        {aseguradoras.length > 0 && (
          <div className="min-w-[125px] flex-1">
            <SelectXuma
              valor={filtros.aseguradora ?? ''}
              opciones={aseguradoras}
              alCambiar={elegirAseguradora}
              placeholder="Aseguradora"
              etiquetaTodo="Todas aseguradoras"
              compact
            />
          </div>
        )}

        {/* Gasera */}
        <div className="min-w-[120px] flex-1">
          <SelectXuma
            valor={filtros.gasera ?? ''}
            opciones={gaseras}
            alCambiar={elegirGasera}
            placeholder="Gasera"
            etiquetaTodo="Todas las gaseras"
            compact
          />
        </div>

        {/* Producto */}
        <div className="min-w-[130px] flex-1">
          <SelectXuma
            valor={filtros.producto ?? ''}
            opciones={productos}
            alCambiar={elegirProducto}
            placeholder="Producto"
            etiquetaTodo="Todos los productos"
            compact
          />
        </div>

        {/* Estado */}
        <div className="min-w-[130px] flex-1">
          <SelectXuma
            valor={filtros.estado ?? ''}
            opciones={estados}
            alCambiar={elegirEstado}
            placeholder="Estado"
            etiquetaTodo="Todos los estados"
            compact
          />
        </div>

        {/* Tipo Siniestro (sólo para vistas que lo necesiten, e.j. mapa) */}
        {mostrarTipoSiniestro && tiposSiniestro.length > 0 && (
          <div className="min-w-[140px] flex-1">
            <SelectXuma
              valor={filtros.tipo_siniestro ?? ''}
              opciones={tiposSiniestro}
              alCambiar={elegirTipoSiniestro}
              placeholder="Tipo Siniestro"
              etiquetaTodo="Todos los tipos"
              compact
            />
          </div>
        )}

        {/* Acciones y Estados */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <AnimatePresence>
            {cargando && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1 rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-2 py-0.5 text-[10px] font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro"
              >
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                <span className="hidden md:inline">Actualizando</span>
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {activos > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="rounded-full border border-xuma-verde-claro/40 bg-xuma-verde-claro/10 px-2 py-0.5 text-[10px] font-bold text-xuma-verde-oscuro dark:text-xuma-verde-claro"
              >
                {activos} act.
              </motion.span>
            )}
          </AnimatePresence>

          <button
            type="button"
            title="Restablecer filtros del reporte"
            onClick={() => { setTexto(''); onReset(); }}
            className="flex cursor-pointer items-center gap-1 rounded-lg border border-tinta/15 bg-tinta/5 px-2.5 py-1.5 text-xs font-semibold text-tinta/70 transition-colors hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-300"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Restablecer</span>
          </button>
        </div>
      </div>
    </motion.section>
  );
}