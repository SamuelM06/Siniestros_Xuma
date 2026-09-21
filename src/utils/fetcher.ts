import type { Filters } from '../lib/types';

// Último día real de un mes según su año (respeta años bisiestos).
function ultimoDiaMes(mes: string): number {
  const [yy, mm] = mes.split('-').map(Number);
  if (!yy || !mm || mm < 1 || mm > 12) return 31;
  return new Date(yy, mm, 0).getDate();
}

// Convierte filtros en query string para los endpoints de la API.
export function queryString(f: Filters): string {
  const p = new URLSearchParams();
  if (f.contrato) p.set('contrato', f.contrato);
  if (f.mes) {
    p.set('desde', `${f.mes}-01`);
    p.set('hasta', `${f.mes}-${String(ultimoDiaMes(f.mes)).padStart(2, '0')}`);
  } else {
    if (f.desde) p.set('desde', f.desde);
    if (f.hasta) p.set('hasta', f.hasta);
  }
  if (f.gasera) p.set('gasera', f.gasera);
  if (f.producto) p.set('producto', f.producto);
  if (f.estado) p.set('estado', f.estado);
  if (f.aseguradora) p.set('aseguradora', f.aseguradora);
  if (f.tipo_siniestro) p.set('tipo_siniestro', f.tipo_siniestro);
  return p.toString();
}