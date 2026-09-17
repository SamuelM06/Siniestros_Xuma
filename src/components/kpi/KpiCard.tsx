import { useEffect, useRef } from 'react';
import { animate, motion, useInView } from 'motion/react';
import { formatCOP, formatNum } from '../../utils/formatters';

interface Props {
  titulo: string;
  valor: number;
  icono: string;
  moneda?: boolean;
  acento: 'azul' | 'verde-claro' | 'verde-oscuro' | 'violeta' | 'ambar';
  sub?: string;
  delay?: number;
}

const ACENTOS: Record<Props['acento'], { barra: string; glow: string; text: string }> = {
  azul: { barra: 'from-[#120180] to-[#6a4fd8]', glow: 'shadow-[0_0_35px_-10px_rgba(106,79,216,0.6)]', text: 'text-[#b8c0ff]' },
  'verde-claro': { barra: 'from-[#5ae280] to-[#00cd93]', glow: 'shadow-[0_0_35px_-10px_rgba(90,226,128,0.6)]', text: 'text-[#7df0a0]' },
  'verde-oscuro': { barra: 'from-[#00cd93] to-[#5ae280]', glow: 'shadow-[0_0_35px_-10px_rgba(0,205,147,0.6)]', text: 'text-[#63e2b9]' },
  violeta: { barra: 'from-[#8b7bff] to-[#3d22c8]', glow: 'shadow-[0_0_35px_-10px_rgba(139,123,255,0.6)]', text: 'text-[#b8c0ff]' },
  ambar: { barra: 'from-[#f0b429] to-[#ef7a6b]', glow: 'shadow-[0_0_35px_-10px_rgba(240,180,41,0.55)]', text: 'text-[#ffd98a]' },
};

// Tarjeta KPI con contador animado (count-up) al entrar en pantalla.
export default function KpiCard({ titulo, valor, icono, moneda = false, acento, sub, delay = 0 }: Props) {
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`glass glass-hover relative overflow-hidden rounded-3xl p-5 ${cfg.glow}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${cfg.barra}`} />
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white/70">{titulo}</p>
        <span className="text-2xl drop-shadow">{icono}</span>
      </div>
      <span
        ref={ref}
        className={`tabular mt-3 block text-3xl font-extrabold tracking-tight md:text-4xl ${cfg.text}`}
      >
        {moneda ? formatCOP(0) : formatNum(0)}
      </span>
      {sub && <p className="mt-2 text-xs text-white/50">{sub}</p>}
    </motion.article>
  );
}