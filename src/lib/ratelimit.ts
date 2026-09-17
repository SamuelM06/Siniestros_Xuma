// Rate limiting en memoria por IP/clave.
// Capa de seguridad: mitiga fuerza bruta de intentos de login y abuso de la API.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: max - 1 };
  }
  b.count += 1;
  if (b.count > max) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)), remaining: 0 };
  }
  return { allowed: true, retryAfterSec: 0, remaining: max - b.count };
}

// Limpieza periódica para que la memoria no crezca sin límite.
export function configurarLimpieza(): () => void {
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (now >= b.resetAt) buckets.delete(k);
    }
  }, 5 * 60_000);
  t.unref?.();
  return () => clearInterval(t);
}