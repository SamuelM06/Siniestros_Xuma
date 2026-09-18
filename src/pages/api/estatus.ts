import type { APIRoute } from 'astro';
import { getEstatus } from '../../lib/query';
import { conError } from '../../lib/api';

export const prerender = false;

const ANIO_POR_DEFECTO = 2026;

export const GET: APIRoute = async ({ url }) => {
  const anioRaw = Number(url.searchParams.get('anio') ?? ANIO_POR_DEFECTO);
  const anio = Number.isInteger(anioRaw) && anioRaw >= 2000 && anioRaw <= 2100 ? anioRaw : ANIO_POR_DEFECTO;
  const ef = {
    anio,
    producto: (url.searchParams.get('producto') ?? '').trim().slice(0, 160) || undefined,
    estado: (url.searchParams.get('estado') ?? '').trim().slice(0, 80) || undefined,
    aseguradora: (url.searchParams.get('aseguradora') ?? '').trim().slice(0, 80) || undefined,
  };
  return conError(() => getEstatus(ef), 'estatus');
};