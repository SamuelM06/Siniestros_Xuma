// ============================================================================
// SESIÓN DEL HUB (web pública y red interna)
// ----------------------------------------------------------------------------
// El Hub emite la cookie `xuma_session`: JWT HS256 firmado con JWT_SECRET, con
// `sub` = id_persona y `exp` en segundos. Aquí solo se VERIFICA (firma, vigencia,
// persona permitida); no se emite nada.
// Limitación conocida: no consulta sesiones revocadas del Hub; una sesión revocada
// vale hasta que expire.
// ============================================================================
import { createHmac, timingSafeEqual } from 'node:crypto';
import { ENV } from './env';

export const HUB_COOKIE = 'xuma_session';

export type ResultadoSesion =
  | { ok: true; persona: string }
  | { ok: false; estado: 401 | 403 };

function b64urlJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function leerCookie(header: string | null, nombre: string): string {
  if (!header) return '';
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return '';
}

export function verificarSesionHub(cookieHeader: string | null): ResultadoSesion {
  // Falla cerrado: sin secreto nadie entra.
  if (!ENV.jwtSecret) return { ok: false, estado: 401 };

  const token = leerCookie(cookieHeader, HUB_COOKIE);
  const partes = token.split('.');
  if (partes.length !== 3) return { ok: false, estado: 401 };
  const [h, p, firma] = partes as [string, string, string];

  const cabecera = b64urlJson(h);
  if (!cabecera || cabecera.alg !== 'HS256') return { ok: false, estado: 401 };

  const esperada = createHmac('sha256', ENV.jwtSecret).update(`${h}.${p}`).digest();
  let recibida: Buffer;
  try {
    recibida = Buffer.from(firma, 'base64url');
  } catch {
    return { ok: false, estado: 401 };
  }
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
    return { ok: false, estado: 401 };
  }

  const claims = b64urlJson(p);
  if (!claims) return { ok: false, estado: 401 };
  const exp = Number(claims.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return { ok: false, estado: 401 };
  const persona = claims.sub == null ? '' : String(claims.sub).trim();
  if (!persona) return { ok: false, estado: 401 };

  // Lista vacía = nadie entra.
  if (!ENV.allowedPersonas.has(persona)) return { ok: false, estado: 403 };
  return { ok: true, persona };
}
