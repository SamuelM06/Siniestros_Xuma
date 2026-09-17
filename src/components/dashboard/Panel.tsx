import { motion } from 'motion/react';
import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  icono?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}

// Panel vidrio (glassmorphism) con animación de entrada escalonada.
export default function Panel({ titulo, icono, children, className = '', delay = 0 }: Props) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`glass rounded-3xl p-5 md:p-6 ${className}`}
    >
      {titulo && (
        <header className="mb-4 flex items-center gap-2.5">
          {icono && <span className="text-xl">{icono}</span>}
          <h2 className="text-base font-bold text-tinta md:text-lg">{titulo}</h2>
        </header>
      )}
      {children}
    </motion.section>
  );
}