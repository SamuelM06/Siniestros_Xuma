// ============================================================================
// MIDDLEWARE DE SEGURIDAD (Astro)
// ----------------------------------------------------------------------------
// 1) Autenticación: TODO el portal exige sesión (excepto /login y assets).
//    → pages: redirige a /login · API: responde 401.
// 2) Endurecimiento: headers de seguridad + CSP en toda respuesta.
// 3) Rate limiting genérico sobre la API (mitigación de abuso / recolección).
// ============================================================================
import { defineMiddleware } from 'astro:middleware';
import { getSessionUser } from './lib/auth';
import { logSecurity } from './lib/log';
import { rateLimit } from './lib/ratelimit';
import { ENV } from './lib/env';

const esRutaApi = (p: string) => p === '/api' || p.startsWith('/api/');
const esLoginApi = (p: string) => p === '/api/auth/login';
const esAsset = (p: string) => /^\/(_astro|logos|fonts)\//.test(p);

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, cookies, clientAddress } = context;
  const path = url.pathname;
  const usuario = getSessionUser(cookies);

  // --- Autenticación global -------------------------------------------------
  if (!usuario && !esLoginApi(path) && !esAsset(path)) {
    logSecurity('SIN SESION', { path, ip: clientAddress });
    if (esRutaApi(path)) {
      return new Response(JSON.stringify({ error: 'No autorizado. Inicie sesión.' }), {
        status: 401,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }
    if (path !== '/login') return redirect('/login');
  }

  if (usuario && path === '/login') return redirect('/dashboard');

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
      "default-src 'self'",
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