import type { RegistroTabla } from '../lib/types';

export interface FilaExcel {
  Contrato: string;
  Asegurado: string;
  Aseguradora: string;
  Gasera: string;
  Producto: string;
  Estado: string;
  'Fecha de radicación': string;
  'Monto (COP)': number;
}

// Convierte registros en filas listas para Excel.
function aFilas(rows: RegistroTabla[]): FilaExcel[] {
  return rows.map((r) => ({
    Contrato: r.numero_contrato ?? '',
    Asegurado: r.nombre_asegurado ?? '',
    Aseguradora: r.aseguradora,
    Gasera: r.gasera,
    Producto: r.producto,
    Estado: r.estado,
    'Fecha de radicación': r.fecha_radicacion ?? '',
    'Monto (COP)': r.monto ?? 0,
  }));
}

// Genera y descarga el archivo .xlsx con los registros indicados.
// xlsx se carga bajo demanda para no inflar el bundle inicial.
export async function descargarExcel(rows: RegistroTabla[], nombreExtra = ''): Promise<void> {
  const XLSX = await import('xlsx');
  const filas = aFilas(rows.slice(0, 100000));
  const hoja = XLSX.utils.json_to_sheet(filas, { origin: -1 });
  hoja['!cols'] = [
    { wch: 16 }, { wch: 30 }, { wch: 24 }, { wch: 24 }, { wch: 26 }, { wch: 26 }, { wch: 15 }, { wch: 18 },
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Siniestros');
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `siniestros_xuma_${fecha}${nombreExtra}.xlsx`.replace(/\s+/g, '_');
  XLSX.writeFile(libro, nombre);
}