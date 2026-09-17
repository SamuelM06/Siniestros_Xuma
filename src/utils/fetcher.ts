import type { Filters } from '../lib/types';

// Convierte filtros en query string para los endpoints de la API.
export function queryString(f: Filters): string {
  const p = new URLSearchParams();
  if (f.contrato) p.set('contrato', f.contrato);
  if (f.desde) p.set('desde', f.desde);
  if (f.hasta) p.set('hasta', f.hasta);
  if (f.gasera) p.set('gasera', f.gasera);
  if (f.producto) p.set('producto', f.producto);
  return p.toString();
}