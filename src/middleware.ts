// ============================================================================
// MIDDLEWARE DE SEGURIDAD (Astro)
// ----------------------------------------------------------------------------
// 1) Autenticación: TODO el portal exige la sesión del Hub (cookie xuma_session),
//    tanto en la web pública como en la red interna. Sin sesión → 401; persona
//    fuera de ALLOWED_PERSONAS → 403. Los estáticos pasan sin sesión.
// 2) Endurecimiento: headers de seguridad + CSP en toda respuesta.
// 3) Rate limiting genérico sobre la API (mitigación de abuso / recolección).
// ============================================================================
import { defineMiddleware } from 'astro:middleware';
import { rateLimit } from './lib/ratelimit';
import { ENV } from './lib/env';
import { ruta, sinBase } from './lib/base';
import { verificarSesionHub } from './lib/hubAuth';

const esRutaApi = (p: string) => p === '/api' || p.startsWith('/api/');

// Estáticos que no llevan datos: pasan sin sesión (healthcheck, logos, fuentes, bundles).
const ESTATICOS = ['/_astro/', '/fonts/', '/logos/'];
const esEstatico = (p: string) => p === '/favicon.svg' || ESTATICOS.some((e) => p.startsWith(e));

function respuestaAcceso(estado: 401 | 403): Response {
  return new Response(
    JSON.stringify({ error: estado === 401 ? 'Sesión requerida' : 'Sin permiso para este reporte' }),
    { status: estado, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, clientAddress } = context;
  const path = sinBase(url.pathname);

  // --- Sesión del Hub ------------------------------------------------------------
  // AUTH_DEV solo vale fuera de producción.
  // Solo se exige en el despliegue público (REQUIRE_HUB_SESSION=true); la red interna no cambia.
  const saltarAuth = !ENV.exigirSesionHub || (ENV.authDev && !import.meta.env.PROD);
  if (!saltarAuth && !esEstatico(path)) {
    const sesion = verificarSesionHub(context.request.headers.get('cookie'));
    if (!sesion.ok) return respuestaAcceso(sesion.estado);
  }

  if (path === '/login' || path === '/login/') {
    return redirect(ruta('/dashboard'));
  }

  // --- Ratelimit sobre la API autenticada ------------------------------------
  if (esRutaApi(path)) {
    const kapi = rateLimit(`api:${clientAddress}`, ENV.rateApiMax, ENV.rateApiWindowMs);
    if (!kapi.allowed) {
      return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Intente luego.' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'retry-after': String(kapi.retryAfterSec),
        },
      });
    }
  }

  // --- Ejecutar la ruta --------------------------------------------------------
  const response = await next();

  // --- Endurecimiento de respuesta --------------------------------------------
  const headers = new Headers(response.headers);
  // Despliegue público: el Hub embebe el reporte en un iframe del mismo origen.
  headers.set('X-Frame-Options', ENV.exigirSesionHub ? 'SAMEORIGIN' : 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self' blob:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.google.com https://*.googleapis.com https://*.gstatic.com",
      "font-src 'self'",
      "connect-src 'self' ws: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.google.com https://*.googleapis.com https://*.gstatic.com",
      ENV.exigirSesionHub ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
    ].join('; '),
  );
  if (ENV.isHttps) headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (esRutaApi(path)) headers.set('Cache-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});