import { useEffect, useRef } from 'react';
import { animate, motion, useInView } from 'motion/react';
import { formatCOP, formatNum } from '../../utils/formatters';
import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  valor: number;
  icono: ReactNode;
  moneda?: boolean;
  acento: 'azul' | 'verde-claro' | 'verde-oscuro' | 'violeta' | 'ambar';
  sub?: string;
  delay?: number;
  grande?: boolean;
  hero?: boolean;
}

const ACENTOS: Record<Props['acento'], { barra: string; glow: string; num: string }> = {
  azul: { barra: 'from-[#120180] to-[#6a4fd8]', glow: 'shadow-[0_0_35px_-10px_rgba(106,79,216,0.6)]', num: 'num-azul' },
  'verde-claro': { barra: 'from-[#5ae280] to-[#00cd93]', glow: 'shadow-[0_0_35px_-10px_rgba(90,226,128,0.6)]', num: 'num-verde' },
  'verde-oscuro': { barra: 'from-[#00cd93] to-[#5ae280]', glow: 'shadow-[0_0_35px_-10px_rgba(0,205,147,0.6)]', num: 'num-teal' },
  violeta: { barra: 'from-[#8b7bff] to-[#3d22c8]', glow: 'shadow-[0_0_35px_-10px_rgba(139,123,255,0.6)]', num: 'num-violeta' },
  ambar: { barra: 'from-[#f0b429] to-[#ef7a6b]', glow: 'shadow-[0_0_35px_-10px_rgba(240,180,41,0.55)]', num: 'num-ambar' },
};

const icCls = {
  azul: 'text-[#6a4fd8] dark:text-[#b8c0ff]',
  'verde-claro': 'text-[#007a54] dark:text-[#7df0a0]',
  'verde-oscuro': 'text-[#008a63] dark:text-[#63e2b9]',
  violeta: 'text-[#6a4fd8] dark:text-[#b8c0ff]',
  ambar: 'text-[#b45309] dark:text-[#ffd98a]',
} as const;

// Tarjeta KPI con contador animado (count-up) al entrar en pantalla.
export default function KpiCard({ titulo, valor, icono, moneda = false, acento, sub, delay = 0, grande = false, hero = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const cfg = ACENTOS[acento];

  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, valor, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = moneda ? formatCOP(v) : formatNum(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, valor, moneda]);

  if (grande) {
    return (
      <motion.article
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
        className={`glass glass-hover relative overflow-hidden rounded-3xl p-5 md:p-6 ${hero ? 'flex h-full min-h-48 flex-col justify-between gap-4 @container' : ''} ${cfg.glow}`}
      >
        <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${cfg.barra}`} />
        {hero ? (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-tinta/70">
              <span className={`drop-shadow ${icCls[acento]}`}>{icono}</span>
              {titulo}
            </p>
            <span
              ref={ref}
              className={`tabular block text-[clamp(1.75rem,14cqw,3rem)] font-extrabold leading-none tracking-tight ${cfg.num}`}
            >
              {moneda ? formatCOP(0) : formatNum(0)}
            </span>
            {sub && <p className="text-xs text-tinta/55">{sub}</p>}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-tinta/70">
                  <span className={`drop-shadow ${icCls[acento]}`}>{icono}</span>
                  {titulo}
                </p>
                {sub && <p className="mt-1.5 text-xs text-tinta/50">{sub}</p>}
              </div>
              <span
                ref={ref}
                className={`tabular text-3xl font-extrabold tracking-tight md:text-4xl ${cfg.num}`}
              >
                {moneda ? formatCOP(0) : formatNum(0)}
              </span>
            </div>
          </>
        )}
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`glass glass-hover relative overflow-hidden rounded-3xl p-4 ${cfg.glow}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${cfg.barra}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-tinta/70">{titulo}</p>
        <span className={`text-xl drop-shadow ${icCls[acento]}`}>{icono}</span>
      </div>
      <span
        ref={ref}
        className={`tabular mt-2 block text-3xl font-extrabold tracking-tight md:text-4xl ${cfg.num}`}
      >
        {moneda ? formatCOP(0) : formatNum(0)}
      </span>
      {sub && <p className="mt-2 text-xs text-tinta/50">{sub}</p>}
    </motion.article>
  );
}