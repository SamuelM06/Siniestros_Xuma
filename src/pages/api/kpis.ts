import type { APIRoute } from 'astro';
import { getKpis } from '../../lib/query';
import { parseFilters } from '../../lib/query';
import { conError } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const f = parseFilters(url);
  return conError(() => getKpis(f), 'kpis');
};