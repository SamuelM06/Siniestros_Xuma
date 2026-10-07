import type { APIRoute } from 'astro';
import { construirExcelDetalle } from '../../lib/excel';
import { construirPdfDetalle } from '../../lib/pdf';
import { LIMITE_EXPORT_FILAS, getDetalleExport, parseFilters } from '../../lib/query';
import { logError } from '../../lib/log';
import type { Filters } from '../../lib/types';

export const prerender = false;

const ETIQUETAS: { clave: keyof Filters; nombre: string }[] = [
  { clave: 'clase', nombre: 'Clase' },
  { clave: 'gasera', nombre: 'Gasera' },
  { clave: 'producto', nombre: 'Producto' },
  { clave: 'estado', nombre: 'Estado' },
  { clave: 'aseguradora', nombre: 'Aseguradora' },
  { clave: 'tipo_siniestro', nombre: 'Tipo' },
];

// Describe los filtros activos en texto legible (va en el subtítulo del .xlsx).
function describirFiltros(f: Filters): string {
  const partes: string[] = [];
  if (f.contrato) partes.push(`Contrato: ${f.contrato}`);
  for (const { clave, nombre } of ETIQUETAS) {
    const v = f[clave];
    if (Array.isArray(v) && v.length > 0) partes.push(`${nombre}: ${v.join(', ')}`);
  }
  if (f.mes) partes.push(`Mes: ${f.mes}`);
  else partes.push(`Rango: ${f.desde ?? ''} a ${f.hasta ?? ''}`);
  if (f.anio) partes.push(`Año: ${f.anio}`);
  return partes.length > 0 ? partes.join('  ·  ') : 'Sin filtros (todos los registros)';
}

function entero(sp: URLSearchParams, clave: string, porDefecto: number, min: number, max: number): number {
  const n = Number(sp.get(clave) ?? porDefecto);
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export const GET: APIRoute = async ({ url }) => {
  const f = parseFilters(url);
  const sp = url.searchParams;
  const modo = sp.get('modo') ?? 'todo';
  const bruto = (sp.get('formato') ?? 'excel').toLowerCase();
  const formato: 'excel' | 'pdf' = bruto === 'pdf' ? 'pdf' : 'excel';
  const size = entero(sp, 'size', 15, 1, 100);

  let offset = 0;
  let limite = LIMITE_EXPORT_FILAS;
  let sufijo = '_total';
  if (modo === 'pagina') {
    const p = entero(sp, 'pagina', 1, 1, 100_000);
    offset = (p - 1) * size;
    limite = size;
    sufijo = `_pagina${p}`;
  } else if (modo === 'rango') {
    // OJO: `desde`/`hasta` ya son el rango de FECHAS de los filtros, así que el
    // rango de PÁGINAS usa nombres propios para no colisionar.
    const d = entero(sp, 'paginaDesde', 1, 1, 100_000);
    const h = entero(sp, 'paginaHasta', d, d, 100_000);
    offset = (d - 1) * size;
    limite = Math.min((h - d + 1) * size, LIMITE_EXPORT_FILAS);
    sufijo = h === d ? `_pagina${d}` : `_paginas${d}_a_${h}`;
  }

  try {
    const { registros, total, truncado } = await getDetalleExport(f, offset, limite);
    if (registros.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay registros para exportar con estos filtros.' }), {
        status: 404,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }
    const hoy = new Date().toISOString().slice(0, 10);
    const anio = f.anio ?? (f.desde ?? '').slice(0, 4) ?? '';
    const filtros = describirFiltros(f);
    const meta = {
      titulo: `Detalle de siniestros · ${anio || '2026'}`,
      subtitulo: truncado
        ? `${filtros}  ·  AVISO: exportado solo el tope de ${LIMITE_EXPORT_FILAS.toLocaleString('es-CO')} filas de ${total.toLocaleString('es-CO')}`
        : filtros,
      generado: new Date(),
    };
    const esPdf = formato === 'pdf';
    const buffer = esPdf ? await construirPdfDetalle(registros, meta) : await construirExcelDetalle(registros, meta);
    const ext = esPdf ? 'pdf' : 'xlsx';
    const nombre = `siniestros_xuma_${hoy}${sufijo}_de_${total}.${ext}`.replace(/\s+/g, '_');
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'content-type': esPdf
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${nombre}"`,
        'cache-control': 'no-store',
        'x-total-registros': String(total),
        'x-filas-exportadas': String(registros.length),
      },
    });
  } catch (err) {
    logError('exportar', err);
    return new Response(
      JSON.stringify({ error: `No se pudo generar el archivo de ${formato === 'pdf' ? 'PDF' : 'Excel'}.` }),
      {
        status: 500,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      },
    );
  }
};
