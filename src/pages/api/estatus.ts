import type { APIRoute } from 'astro';
import { getEstatus } from '../../lib/query';
import { conError } from '../../lib/api';

export const prerender = false;

const ANIO_POR_DEFECTO = 2026;

export const GET: APIRoute = async ({ url }) => {
  const anioRaw = Number(url.searchParams.get('anio') ?? ANIO_POR_DEFECTO);
  const anio = Number.isInteger(anioRaw) && anioRaw >= 2000 && anioRaw <= 2100 ? anioRaw : ANIO_POR_DEFECTO;
  const limpiar = (valores: string[], max: number): string[] | undefined => {
    const vistos = new Set<string>();
    for (const r of valores) {
      const v = (r ?? '').trim().slice(0, max);
      if (v !== '') vistos.add(v);
    }
    return vistos.size > 0 ? [...vistos] : undefined;
  };
  const ef = {
    anio,
    gasera: limpiar(url.searchParams.getAll('gasera'), 120),
    producto: limpiar(url.searchParams.getAll('producto'), 160),
    aseguradora: limpiar(url.searchParams.getAll('aseguradora'), 80),
    clase: limpiar(url.searchParams.getAll('clase'), 40),
  };
  return conError(() => getEstatus(ef), 'estatus');
};