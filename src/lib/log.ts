import { appendFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const LOG_DIR = join(ROOT, '..', 'logs');

function entry(line: string): void {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(join(LOG_DIR, 'app.log'), `${new Date().toISOString()} ${line}\n`, 'utf8');
  } catch {
    // El logging nunca debe tumbar la aplicación
  }
}

// Bitácora de eventos de seguridad (accesos, intentos, sesiones).
export function logSecurity(evento: string, detalle: Record<string, unknown>): void {
  const extra = Object.entries(detalle)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');
  entry(`SECURITY ${evento} ${extra}`);
}

export function logError(evento: string, detalle: unknown): void {
  const msg = detalle instanceof Error ? `${detalle.message} @ ${detalle.stack ?? ''}` : JSON.stringify(detalle);
  entry(`ERROR ${evento} ${msg}`);
}