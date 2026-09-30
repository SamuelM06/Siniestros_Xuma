import type { RegistroTabla } from '../lib/types';
import { formatAseguradoExcel } from './formatters';

export interface FilaExcel {
  Contrato: string;
  Asegurado: string;
  Aseguradora: string;
  Gasera: string;
  Clase: string;
  Producto: string;
  Estado: string;
  'Fecha de radicación': string;
  'Monto (COP)': number;
}

// Convierte registros en filas listas para Excel.
function aFilas(rows: RegistroTabla[]): FilaExcel[] {
  return rows.map((r) => ({
    Contrato: r.numero_contrato ?? '',
    Asegurado: formatAseguradoExcel(r.nombre_asegurado),
    Aseguradora: r.aseguradora,
    Gasera: r.gasera,
    Clase: r.clase,
    Producto: r.producto,
    Estado: r.estado,
    'Fecha de radicación': r.fecha_radicacion ?? '',
    'Monto (COP)': r.monto ?? 0,
  }));
}

// ---- Exportación de la matriz de estatus (gasera × estado × mes) ---------------
export interface FilaEstatusExcel {
  gasera: string;
  estado: string; // 'TOTAL' en la fila agregada de cada gasera
  meses: number[];
  total: number;
}

// Genera y descarga el .xlsx de la matriz de estatus con sus estados.
// xlsx se carga bajo demanda para no inflar el bundle inicial.
export async function descargarExcelEstatus(args: {
  anio: number;
  meses: string[];
  filas: FilaEstatusExcel[];
}): Promise<void> {
  const XLSX = await import('xlsx');
  const encabezado = ['Gasera', 'Estado', ...args.meses, 'Total'];
  const cuerpo: (string | number)[][] = args.filas.map((f) => [f.gasera, f.estado, ...f.meses, f.total]);
  const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...cuerpo]);
  hoja['!cols'] = [{ wch: 26 }, { wch: 24 }, ...args.meses.map(() => ({ wch: 12 })), { wch: 14 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, `Estatus ${args.anio}`);
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `estatus_siniestros_${args.anio}_${fecha}.xlsx`;
  const datos = XLSX.write(libro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([datos], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Genera y descarga el archivo .xlsx con los registros indicados.
// xlsx se carga bajo demanda para no inflar el bundle inicial.
export async function descargarExcel(rows: RegistroTabla[], nombreExtra = ''): Promise<void> {
  const XLSX = await import('xlsx');
  const filas = aFilas(rows.slice(0, 100000));
  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja['!cols'] = [
    { wch: 16 }, { wch: 30 }, { wch: 24 }, { wch: 24 }, { wch: 26 }, { wch: 26 }, { wch: 15 }, { wch: 18 },
  ];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Siniestros');
  const fecha = new Date().toISOString().slice(0, 10);
  const nombre = `siniestros_xuma_${fecha}${nombreExtra}.xlsx`.replace(/\s+/g, '_');
  const datos = XLSX.write(libro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([datos], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}