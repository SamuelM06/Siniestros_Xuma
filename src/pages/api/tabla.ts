import type { APIRoute } from 'astro';
import { getTabla, parseFilters } from '../../lib/query';
import { conError } from '../../lib/api';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const f = parseFilters(url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const pageSize = Math.min(100, Math.max(5, Number(url.searchParams.get('size') ?? '15') || 15));
  return conError(() => getTabla(f, page, pageSize), 'tabla');
};