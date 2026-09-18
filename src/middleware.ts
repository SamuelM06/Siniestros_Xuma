// ============================================================================
// MIDDLEWARE DE SEGURIDAD (Astro)
// ----------------------------------------------------------------------------
// 1) Autenticación: TODO el portal exige sesión (excepto /login y assets).
//    → pages: redirige a /login · API: responde 401.
// 2) Endurecimiento: headers de seguridad + CSP en toda respuesta.
// 3) Rate limiting genérico sobre la API (mitigación de abuso / recolección).
// ============================================================================
import { defineMiddleware } from 'astro:middleware';
import { rateLimit } from './lib/ratelimit';
import { ENV } from './lib/env';

const esRutaApi = (p: string) => p === '/api' || p.startsWith('/api/');

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, clientAddress } = context;
  const path = url.pathname;
  // --- Acceso sin login (login deshabilitado/oculto) -----------------------
  if (path === '/login' || path === '/login/') {
    return redirect('/dashboard');
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
  headers.set('X-Frame-Options', 'DENY');
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
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' ws:",
      "frame-ancestors 'none'",
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