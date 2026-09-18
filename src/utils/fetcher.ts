import type { Filters } from '../lib/types';

const ULTIMO_DIA: Record<number, number> = {
  1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

// Convierte filtros en query string para los endpoints de la API.
export function queryString(f: Filters): string {
  const p = new URLSearchParams();
  if (f.contrato) p.set('contrato', f.contrato);
  if (f.mes) {
    const mm = Number(f.mes.split('-')[1] ?? 0);
    p.set('desde', `${f.mes}-01`);
    p.set('hasta', `${f.mes}-${String(ULTIMO_DIA[mm] ?? 30).padStart(2, '0')}`);
  } else {
    if (f.desde) p.set('desde', f.desde);
    if (f.hasta) p.set('hasta', f.hasta);
  }
  if (f.gasera) p.set('gasera', f.gasera);
  if (f.producto) p.set('producto', f.producto);
  if (f.estado) p.set('estado', f.estado);
  return p.toString();
}