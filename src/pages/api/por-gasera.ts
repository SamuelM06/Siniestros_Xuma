import type { APIRoute } from 'astro';
import { getPorGasera, parseFilters } from '../../lib/query';
import { conError } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const f = parseFilters(url);
  return conError(() => getPorGasera(f), 'por-gasera');
};