import type { APIRoute } from 'astro';
import { getTendencia, parseFilters } from '../../lib/query';
import { conError } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const f = parseFilters(url);
  return conError(() => getTendencia(f), 'tendencia');
};