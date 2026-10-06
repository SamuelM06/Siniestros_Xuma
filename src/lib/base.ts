// ============================================================================
// RUTAS BAJO SUBRUTA
// ----------------------------------------------------------------------------
// En producción el reporte vive en https://<dominio>/<ruta>/ (BASE_PATH al compilar).
// En local BASE_PATH queda vacío y todo funciona en la raíz, como siempre.
// Usable en servidor y en componentes del navegador (sin imports de Node).
// ============================================================================
const BASE: string = ((import.meta.env.BASE_URL as string | undefined) ?? '/').replace(/\/+$/, '');

/** ruta('/dashboard') → '/<ruta>/dashboard'. Rutas ya prefijadas o externas no se tocan. */
export function ruta(p: string): string {
  if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(p)) return p;
  const limpia = p.startsWith('/') ? p : `/${p}`;
  if (BASE && (limpia === BASE || limpia.startsWith(`${BASE}/`))) return limpia;
  return `${BASE}${limpia}`;
}

/** Quita el prefijo base de un pathname para evaluar reglas por ruta. */
export function sinBase(pathname: string): string {
  if (BASE && (pathname === BASE || pathname.startsWith(`${BASE}/`))) {
    return pathname.slice(BASE.length) || '/';
  }
  return pathname;
}

export const BASE_PATH = BASE;
