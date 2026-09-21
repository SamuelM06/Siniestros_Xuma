import { query, queryOne } from './db';
import { DEPARTAMENTO_SQL, ESTADO_SQL, GASERA_SQL, MONTO_SQL, MUNICIPIO_SQL, PRODUCTO_SQL } from './normalizacion';
import type {
  EstatusData, Filters, FilaEstatus, ItemDepartamento, ItemGasera, ItemMunicipio, ItemProducto, KpisData, MapaData, Metadatos, PaginaTabla, PuntoTendencia, RegistroTabla, SerieAseguradora,
} from './types';

// ============================================================================
// CTE base: agrega las columnas normalizadas + aseguradora canónica.
// Alias de la tabla origen: SIEMPRE `c`. Join a catálogo de aseguradoras.
// Promigas no es una gasera (dato escrito mal en la fuente): se excluye para
// que no aparezca en ningún gráfico, filtro ni total.
// ============================================================================
const BASE = `
  SELECT sub.*
  FROM (
    SELECT c.*,
      ${ESTADO_SQL}       AS estado_norm,
      ${GASERA_SQL}       AS gasera_norm,
      ${PRODUCTO_SQL}     AS producto_norm,
      ${DEPARTAMENTO_SQL} AS departamento_norm,
      ${MUNICIPIO_SQL}    AS municipio_norm,
      ${MONTO_SQL}        AS monto,
      CASE
        WHEN a.nombre ILIKE 'Cardif%' THEN 'Cardif'
        ELSE a.nombre
      END               AS aseguradora_norm
    FROM siniestros.casos c
    JOIN siniestros.aseguradoras a ON a.id_aseguradora = c.id_aseguradora
  ) sub
  WHERE sub.gasera_norm <> 'Promigas'
`;

const ANIO_REPORTE = 2026;
const ANIO_PREVIO = ANIO_REPORTE - 1;

// ---- Filtros ------------------------------------------------------------------
const VAL_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function parseFecha(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!VAL_FECHA.test(v)) return undefined;
  const [yy = 0, mm = 0, dd = 0] = v.split('-').map(Number);
  const fecha = new Date(yy, mm - 1, dd);
  if (fecha.getFullYear() !== yy || fecha.getMonth() !== mm - 1 || fecha.getDate() !== dd) return undefined;
  return v;
}

function parseTexto(raw: string | null | undefined, max = 80): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().slice(0, max);
  return v === '' ? undefined : v;
}

function clampMinMax(desde?: string, hasta?: string): { desde: string; hasta: string } {
  if (desde && hasta && hasta < desde) return { desde: hasta, hasta: desde };
  return { desde: desde ?? `${ANIO_REPORTE}-01-01`, hasta: hasta ?? `${ANIO_REPORTE}-12-31` };
}

export function parseFilters(url: URL): Filters {
  const rango = clampMinMax(parseFecha(url.searchParams.get('desde')), parseFecha(url.searchParams.get('hasta')));
  const contrato = parseTexto(url.searchParams.get('contrato'));
  const gasera = parseTexto(url.searchParams.get('gasera'), 120);
  const producto = parseTexto(url.searchParams.get('producto'), 160);
  const estado = parseTexto(url.searchParams.get('estado'), 80);
  const aseguradora = parseTexto(url.searchParams.get('aseguradora'), 80);
  return { contrato, gasera, producto, estado, aseguradora, desde: rango.desde, hasta: rango.hasta };
}

// Convierte fecha (Date de pg o texto) a ISO YYYY-MM-DD sin desfase de zona.
function aISO(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function filtrosPorDefecto(): Filters {
  return { desde: `${ANIO_REPORTE}-01-01`, hasta: `${ANIO_REPORTE}-12-31` };
}

type RowBase = Record<string, unknown>;

// Caché en memoria para consultas pesadas con datos casi estáticos (mapa y
// metadatos). Evita re-consultar la BD remota al volver a una vista ya cargada
// con los mismos filtros dentro de la ventana de tiempo.
const CACHE_TTL_MS = 60_000;
const cacheConsultas = new Map<string, { t: number; v: unknown }>();

async function conCache<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const hit = cacheConsultas.get(clave);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v as T;
  const v = await fn();
  cacheConsultas.set(clave, { t: Date.now(), v });
  return v;
}

// Clave de caché estable para un conjunto de filtros.
function serializarFiltros(f: Filters | EstatusFiltros): string {
  const ordenado: Record<string, unknown> = {};
  for (const k of Object.keys(f).sort()) {
    const v = (f as Record<string, unknown>)[k];
    if (v !== undefined && v !== null) ordenado[k] = v;
  }
  return JSON.stringify(ordenado);
}

function construirWhere(f: Filters): { cond: string; params: unknown[] } {
  const cond: string[] = [];
  const params: unknown[] = [];

  // Si se busca un contrato específico, buscar de forma flexible en numero_contrato
  // y campos originales (incluso identificaciones), sin que el rango estricto de fechas lo oculte
  if (f.contrato) {
    params.push(f.contrato);
    cond.push(`(
      numero_contrato ILIKE '%' || $${params.length} || '%'
      OR btrim(COALESCE(datos_originales->>'CONTRATO','')) ILIKE '%' || $${params.length} || '%'
      OR btrim(COALESCE(datos_originales->>'# Contr4ato','')) ILIKE '%' || $${params.length} || '%'
      OR btrim(COALESCE(datos_originales->>'No. CONTRATO','')) ILIKE '%' || $${params.length} || '%'
      OR btrim(COALESCE(datos_originales->>'NO. CREDITO','')) ILIKE '%' || $${params.length} || '%'
      OR btrim(COALESCE(datos_originales->>'CED_AFECTADO','')) ILIKE '%' || $${params.length} || '%'
      OR btrim(COALESCE(datos_originales->>'CEDULA','')) ILIKE '%' || $${params.length} || '%'
      OR btrim(COALESCE(datos_originales->>'Nroidentificacion','')) ILIKE '%' || $${params.length} || '%'
    )`);
    // Si el usuario fijó fechas personalizadas (distintas al año default), se respetan
    if (f.desde && f.hasta && (f.desde !== `${ANIO_REPORTE}-01-01` || f.hasta !== `${ANIO_REPORTE}-12-31`)) {
      params.push(f.desde, f.hasta);
      cond.push(`fecha_radicacion >= $${params.length - 1}::date AND fecha_radicacion < ($${params.length}::date + interval '1 day')`);
    }
  } else {
    params.push(f.desde, f.hasta);
    cond.push(`fecha_radicacion >= $${params.length - 1}::date AND fecha_radicacion < ($${params.length}::date + interval '1 day')`);
  }

  if (f.gasera) {
    params.push(f.gasera);
    cond.push(`gasera_norm = $${params.length}`);
  }
  if (f.producto) {
    params.push(f.producto);
    cond.push(`producto_norm = $${params.length}`);
  }
  if (f.estado) {
    params.push(f.estado);
    cond.push(`estado_norm = $${params.length}`);
  }
  if (f.aseguradora) {
    params.push(f.aseguradora);
    cond.push(`aseguradora_norm = $${params.length}`);
  }
  return { cond: cond.join(' AND '), params };
}

// ---- KPIs ---------------------------------------------------------------------
export async function getKpis(f: Filters): Promise<KpisData> {
  return conCache(`kpis:${serializarFiltros(f)}`, async () => {
  const w = construirWhere(f);
  const sql = `
    WITH base AS (${BASE}),
    agg AS (
      SELECT
        count(*)::int                                              AS total,
        count(*) FILTER (WHERE estado_norm = 'Pagado')::int        AS pagados,
        count(*) FILTER (WHERE estado_norm = 'Objetado')::int      AS objetados,
        count(*) FILTER (WHERE estado_norm = 'Solicitud de documentos')::int AS solicitud_docs,
        count(*) FILTER (WHERE estado_norm = 'En trámite')::int    AS en_tramite,
        count(*) FILTER (WHERE estado_norm = 'Sin estado')::int    AS sin_estado,
        COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado'), 0)::numeric AS total_pagado
      FROM base
      WHERE ${w.cond}
    )
    SELECT * FROM agg
  `;
  const r = (await queryOne<RowBase>(sql, w.params)) ?? {};
  const total2026 = Number(r.total ?? 0);
  const kpi: KpisData = {
    total: total2026,
    pagados: Number(r.pagados ?? 0),
    objetados: Number(r.objetados ?? 0),
    solicitudDocs: Number(r.solicitud_docs ?? 0),
    enTramite: Number(r.en_tramite ?? 0),
    sinEstado: Number(r.sin_estado ?? 0),
    totalPagado: Number(r.total_pagado ?? 0),
    comparativo: { total2025: 0, total2026, deltaPct: 0 },
  };
  const prev = await getTotalAnio(ANIO_PREVIO);
  if (prev != null) {
    kpi.comparativo.total2025 = prev;
    kpi.comparativo.deltaPct = prev > 0 ? Math.round(((total2026 - prev) / prev) * 1000) / 10 : 0;
  }
  return kpi;
  });
}

async function getTotalAnio(anio: number): Promise<number | null> {
  const r = await queryOne<{ n: number }>(
    `
    SELECT count(*)::int AS n
    FROM (
      SELECT c.fecha_radicacion, ${GASERA_SQL} AS gasera_norm
      FROM siniestros.casos c
    ) sub
    WHERE sub.fecha_radicacion BETWEEN $1::date AND $2::date AND sub.gasera_norm <> 'Promigas'
    `,
    [`${anio}-01-01`, `${anio}-12-31`],
  );
  return r ? Number(r.n) : null;
}

// ---- Tendencia mensual --------------------------------------------------------
export async function getTendencia(f: Filters): Promise<PuntoTendencia[]> {
  return conCache(`tendencia:${serializarFiltros(f)}`, async () => {
  const w = construirWhere(f);
  const sql = `
    WITH base AS (${BASE})
    SELECT to_char(date_trunc('month', fecha_radicacion), 'YYYY-MM') AS mes,
           count(*)::int            AS total,
           COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado'), 0)::numeric AS valor
    FROM base
    WHERE ${w.cond}
    GROUP BY 1 ORDER BY 1
  `;
  const rows = await query<{ mes: string; total: number; valor: string }>(sql, w.params);
  return rellenarMeses(rows, f);
  });
}

// Lista de meses (YYYY-MM) del rango filtrado, recortada al último mes con datos.
function mesesRango(f: Filters, ultimo?: string): string[] {
  const desdeMes = (f.desde ?? '').slice(0, 7);
  const hastaMes = (f.hasta ?? '').slice(0, 7);
  if (!desdeMes || !hastaMes) return [];
  let tope = hastaMes;
  if (ultimo && ultimo < tope) tope = ultimo < desdeMes ? desdeMes : ultimo;
  const [yi = 1, mi = 1] = desdeMes.split('-').map((s) => Number(s));
  const [yf = 1, mf = 1] = tope.split('-').map((s) => Number(s));
  const out: string[] = [];
  let y = yi;
  let m = mi;
  while (y < yf || (y === yf && m <= mf)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

function rellenarMeses(rows: { mes: string; total: number; valor: string }[], f: Filters): PuntoTendencia[] {
  const mapa = new Map(rows.map((r) => [r.mes, r]));
  const ultimo = rows.reduce((mx, r) => (r.mes > mx ? r.mes : mx), '');
  return mesesRango(f, ultimo || undefined).map((mes) => {
    const r = mapa.get(mes);
    return {
      mes,
      label: mes,
      total: r ? Number(r.total) : 0,
      valorPagado: r ? Number(r.valor) : 0,
    };
  });
}

// ---- Siniestros por aseguradora al mes (matriz) -------------------------------
export async function getPorAseguradora(f: Filters): Promise<SerieAseguradora[]> {
  return conCache(`por-aseguradora:${serializarFiltros(f)}`, async () => {
  const w = construirWhere(f);
  const sql = `
    WITH base AS (${BASE})
    SELECT to_char(date_trunc('month', fecha_radicacion), 'YYYY-MM') AS mes,
           aseguradora_norm AS aseguradora,
           count(*)::int AS total
    FROM base
    WHERE ${w.cond}
    GROUP BY 1, 2 ORDER BY 1, 2
  `;
  const rows = await query<{ mes: string; aseguradora: string; total: number }>(sql, w.params);
  const orden = [...new Set(rows.map((r) => r.aseguradora))];
  const ultimo = rows.reduce((mx, r) => (r.mes > mx ? r.mes : mx), '');
  const meses = mesesRango(f, ultimo || undefined);
  return meses.map((mes) => {
    const por: Record<string, number> = {};
    for (const a of orden) por[a] = 0;
    for (const r of rows) if (r.mes === mes) por[r.aseguradora] = Number(r.total);
    return { mes, label: mes, porAseguradora: por };
  });
  });
}

// ---- Por gasera (apropiar top + Otros) ----------------------------------------
export async function getPorGasera(f: Filters, top = 8): Promise<ItemGasera[]> {
  return conCache(`por-gasera:${serializarFiltros(f)}:${top}`, async () => {
  const w = construirWhere(f);
  const sql = `
    WITH base AS (${BASE})
    SELECT COALESCE(gasera_norm,'Sin gasera') AS gasera, count(*)::int AS total
    FROM base
    WHERE ${w.cond}
    GROUP BY 1 ORDER BY total DESC, gasera ASC
  `;
  const rows = await query<ItemGasera>(sql, w.params);
  const cabecera = rows.slice(0, top);
  const resto = rows.slice(top).reduce((acc, r) => acc + Number(r.total), 0);
  return resto > 0 ? [...cabecera, { gasera: 'Otros', total: resto }] : cabecera;
  });
}

// ---- Por producto (apropiar top + Otros) ---------------------------------------
export async function getPorProducto(f: Filters, top = 7): Promise<ItemProducto[]> {
  return conCache(`por-producto:${serializarFiltros(f)}:${top}`, async () => {
  const w = construirWhere(f);
  const sql = `
    WITH base AS (${BASE})
    SELECT producto_norm AS producto, count(*)::int AS total
    FROM base
    WHERE ${w.cond}
    GROUP BY 1 ORDER BY total DESC, producto ASC
  `;
  const rows = await query<ItemProducto>(sql, w.params);
  const cabecera = rows.slice(0, top);
  const resto = rows.slice(top).reduce((acc, r) => acc + Number(r.total), 0);
  return resto > 0 ? [...cabecera, { producto: 'Otros', total: resto }] : cabecera;
  });
}

// ---- Tabla de detalle (paginada, sin campos sensibles) -------------------------
const CAMPOS_TABLA = `
  id_caso, numero_contrato, nombre_asegurado,
  fecha_radicacion,
  aseguradora_norm AS aseguradora,
  gasera_norm AS gasera,
  producto_norm AS producto,
  estado_norm AS estado,
  monto
`;

export async function getTabla(f: Filters, page: number, pageSize: number): Promise<PaginaTabla> {
  return conCache(`tabla:${serializarFiltros(f)}:${page}:${pageSize}`, async () => {
  const w = construirWhere(f);
  const totalRow = await queryOne<{ n: number }>(
    `WITH base AS (${BASE}) SELECT count(*)::int AS n FROM base WHERE ${w.cond}`, w.params,
  );
  const total = totalRow ? Number(totalRow.n) : 0;
  const off = (page - 1) * pageSize;
  const sql = `
    WITH base AS (${BASE})
    SELECT ${CAMPOS_TABLA}
    FROM base
    WHERE ${w.cond}
    ORDER BY fecha_radicacion DESC NULLS LAST, id_caso DESC
    LIMIT $${w.params.length + 1} OFFSET $${w.params.length + 2}
  `;
  const filas = await query<RegistroTabla>(sql, [...w.params, pageSize, off]);
  return {
    registros: filas.map((r) => ({
      id_caso: Number(r.id_caso),
      numero_contrato: r.numero_contrato,
      nombre_asegurado: r.nombre_asegurado,
      aseguradora: r.aseguradora ?? '',
      gasera: r.gasera ?? '',
      producto: r.producto ?? '',
      estado: r.estado ?? '',
      fecha_radicacion: r.fecha_radicacion,
      monto: r.monto == null ? null : Number(r.monto),
    })),
    total,
    page,
    pageSize,
  };
  });
}

// ---- Metadatos para poblar los filtros ----------------------------------------
export async function getMetadatos(f: Filters): Promise<Metadatos> {
  return conCache(`metadatos:${serializarFiltros(f)}`, async () => {
  const w = construirWhere(f);
  const [gasR, prodR, estR, asegR, rangoR] = await Promise.all([
    query<{ gasera: string }>(`WITH base AS (${BASE}) SELECT DISTINCT gasera_norm AS gasera FROM base WHERE ${w.cond} AND gasera_norm IS NOT NULL ORDER BY 1`, w.params),
    query<{ producto: string }>(`WITH base AS (${BASE}) SELECT DISTINCT producto_norm AS producto FROM base WHERE ${w.cond} AND producto_norm IS NOT NULL ORDER BY 1`, w.params),
    query<{ estado: string; total: number }>(`WITH base AS (${BASE}) SELECT COALESCE(estado_norm,'Sin estado') AS estado, count(*)::int AS total FROM base WHERE ${w.cond} GROUP BY 1 ORDER BY total DESC`, w.params),
    query<{ aseguradora: string }>(`WITH base AS (${BASE}) SELECT DISTINCT aseguradora_norm AS aseguradora FROM base WHERE ${w.cond} ORDER BY 1`, w.params),
    queryOne<{ min: string; max: string }>(`WITH base AS (${BASE}) SELECT min(fecha_radicacion) AS min, max(fecha_radicacion) AS max FROM base WHERE ${w.cond}`, w.params),
  ]);
  const aniosR = await query<{ anio: number }>(
    `SELECT DISTINCT EXTRACT(YEAR FROM sub.fecha_radicacion)::int AS anio
  FROM (
    SELECT c.fecha_radicacion, ${GASERA_SQL} AS gasera_norm
    FROM siniestros.casos c
  ) sub
  WHERE sub.fecha_radicacion IS NOT NULL AND sub.gasera_norm <> 'Promigas'
  ORDER BY 1 DESC`,
  );
  return {
    gaseras: gasR.map((r) => r.gasera),
    productos: prodR.map((r) => r.producto),
    estados: estR.map((r) => ({ estado: r.estado, total: Number(r.total) })),
    aseguradoras: asegR.map((r) => r.aseguradora),
    anios: aniosR.map((r) => Number(r.anio)),
    rangoFechas: { min: aISO(rangoR?.min), max: aISO(rangoR?.max) },
  };
  });
}

// ---- Estatus de siniestros por gasera y mes (matriz) --------------------------
export interface EstatusFiltros {
  anio: number;
  producto?: string;
  estado?: string;
  aseguradora?: string;
}

export async function getEstatus(ef: EstatusFiltros): Promise<EstatusData> {
  return conCache(`estatus:${serializarFiltros(ef)}`, async () => {
  const cond: string[] = [];
  const params: unknown[] = [`${ef.anio}-01-01`, `${ef.anio}-12-31`];
  cond.push('fecha_radicacion >= $1::date AND fecha_radicacion <= $2::date');
  if (ef.producto) {
    params.push(ef.producto);
    cond.push(`producto_norm = $${params.length}`);
  }
  if (ef.estado) {
    params.push(ef.estado);
    cond.push(`estado_norm = $${params.length}`);
  }
  if (ef.aseguradora) {
    params.push(ef.aseguradora);
    cond.push(`aseguradora_norm = $${params.length}`);
  }
  const sql = `
    WITH base AS (${BASE})
    SELECT COALESCE(gasera_norm,'Sin gasera') AS gasera,
           EXTRACT(MONTH FROM fecha_radicacion)::int AS mes,
           count(*)::int AS total
    FROM base
    WHERE ${cond.join(' AND ')}
    GROUP BY 1, 2 ORDER BY 1, 2
  `;
  const rows = await query<FilaEstatus>(sql, params);
  const gaseras = [...new Set(rows.map((r) => r.gasera))].sort((a, b) => {
    const ta = rows.filter((r) => r.gasera === a).reduce((s, r) => s + Number(r.total), 0);
    const tb = rows.filter((r) => r.gasera === b).reduce((s, r) => s + Number(r.total), 0);
    return tb - ta;
  });
  return {
    anio: ef.anio,
    gaseras,
    filas: rows.map((r) => ({ gasera: r.gasera, mes: Number(r.mes), total: Number(r.total) })),
  };
  });
}

// ---- Mapa geográfico de siniestros (por departamento y municipios) ------------
export async function getMapa(f: Filters): Promise<MapaData> {
  return conCache(`mapa:${serializarFiltros(f)}`, async () => {
  const w = construirWhere(f);
  const sql = `
    WITH base AS (${BASE}),
    deptos AS (
      SELECT
        departamento_norm AS departamento,
        count(*)::int AS total,
        count(*) FILTER (WHERE estado_norm = 'Pagado')::int AS pagados,
        count(*) FILTER (WHERE estado_norm = 'En trámite')::int AS en_tramite,
        count(*) FILTER (WHERE estado_norm = 'Objetado')::int AS objetados,
        COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado'), 0)::numeric AS total_pagado
      FROM base
      WHERE ${w.cond}
      GROUP BY 1
    ),
    muns AS (
      SELECT
        departamento_norm AS departamento,
        municipio_norm AS municipio,
        count(*)::int AS total,
        COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado'), 0)::numeric AS pagado
      FROM base
      WHERE ${w.cond}
      GROUP BY 1, 2
    ),
    muns_agg AS (
      SELECT
        departamento,
        json_agg(
          json_build_object('municipio', municipio, 'total', total, 'pagado', pagado)
          ORDER BY total DESC
        ) AS municipios
      FROM muns
      GROUP BY departamento
    )
    SELECT
      d.departamento,
      d.total,
      d.pagados,
      d.en_tramite,
      d.objetados,
      d.total_pagado,
      COALESCE(m.municipios, '[]'::json) AS municipios
    FROM deptos d
    LEFT JOIN muns_agg m ON m.departamento = d.departamento
    ORDER BY d.total DESC
  `;

  const rows = await query<{
    departamento: string;
    total: number;
    pagados: number;
    en_tramite: number;
    objetados: number;
    total_pagado: string;
    municipios: ItemMunicipio[];
  }>(sql, w.params);

  const totalNacional = rows.reduce((acc, r) => acc + Number(r.total), 0);
  const totalPagadoNacional = rows.reduce((acc, r) => acc + Number(r.total_pagado), 0);

  return {
    totalNacional,
    totalPagadoNacional,
    departamentos: rows.map((r) => ({
      departamento: r.departamento,
      total: Number(r.total),
      pagados: Number(r.pagados),
      enTramite: Number(r.en_tramite),
      objetados: Number(r.objetados),
      totalPagado: Number(r.total_pagado),
      municipios: r.municipios || [],
    })),
  };
  });
}