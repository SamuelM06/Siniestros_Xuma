import { query, queryOne } from './db';
import { configurarLimpieza } from './ratelimit';
import { DEPARTAMENTO_SQL, CLASE_SQL, ESTADO_SQL, FECHA_EFECTIVA_SQL, GASERA_SQL, MONTO_SQL, MUNICIPIO_SQL, PRODUCTO_SQL } from './normalizacion';
import {
  backtest, chiCuadradoP, distribucion, indicesEstacionales, mannKendall, pronosticar, theilSen,
} from './estadistica';
import type { MesEntrenamiento } from './estadistica';
import type {
  AnioHist, BacktestInfo, CambioEstructural, EstatusData, Filters, FilaEstatus, HistoricosData, IndiceEstacional, ItemDepartamento, ItemGasera, ItemMunicipio, ItemProducto, ItemTipoSiniestro, KpisData, MapaData, Metadatos, PaginaTabla, ProbItem, ProyeccionData, PuntoForecast, PuntoMesHist, PuntoTendencia, RegistroTabla, SerieAseguradora, SerieMensualAnio, TendenciaProy,
} from './types';

// ============================================================================
// CTE base: agrega las columnas normalizadas + aseguradora canónica.
// Alias de la tabla origen: SIEMPRE `c`. Join a catálogo de aseguradoras.
// - Promigas no es una gasera (dato escrito mal en la fuente): se excluye para
//   que no aparezca en ningún gráfico, filtro ni total.
// - Las hojas `*PLANILLA*` son soportes de pago, no siniestros: se excluyen para
//   no duplicar el conteo (la data manda: un siniestro = una fila base).
// - `c.vigente`: las recargas NO borran, dan de baja logica (`vigente=false` +
//   fila en casos_historial). Sin este filtro el tablero contaba tambien las
//   versiones retiradas: 2.191 filas fantasma (2.126 del Caribe viejito y 59
//   del Efigas renombrado) inflando todos los KPIs.
// - `fecha_efectiva` consume la fecha real de la DB: fecha_radicacion primero,
//   luego FECHA RECIBIDO (Salvafactura) y MES+AÑO (PROEXEQUIAL). Lo que no trae
//   fecha útil queda NULL y se excluye de los rangos.
// ============================================================================
const BASE = `
  SELECT sub.*
  FROM (
    SELECT c.*,
      ${ESTADO_SQL}       AS estado_norm,
      ${GASERA_SQL}       AS gasera_norm,
      ${PRODUCTO_SQL}     AS producto_norm,
      ${CLASE_SQL}        AS clase_norm,
      ${FECHA_EFECTIVA_SQL} AS fecha_efectiva,
      ${DEPARTAMENTO_SQL} AS departamento_norm,
      ${MUNICIPIO_SQL}    AS municipio_norm,
      ${MONTO_SQL}        AS monto,
      CASE
        WHEN NULLIF(btrim(c.tipo_siniestro),'') IS NOT NULL THEN btrim(c.tipo_siniestro)
        ELSE 'Sin tipo'
      END                 AS tipo_siniestro_norm,
      CASE
        WHEN a.nombre ILIKE 'Cardif%' THEN 'Cardif'
        ELSE a.nombre
      END               AS aseguradora_norm
    FROM siniestros.casos c
    JOIN siniestros.aseguradoras a ON a.id_aseguradora = c.id_aseguradora
    WHERE c.vigente
      AND c.nombre_archivo_origen NOT ILIKE '%planilla%'
  ) sub
  WHERE sub.gasera_norm <> 'Promigas'
`;

const ANIO_REPORTE = 2026;
const ANIO_PREVIO = ANIO_REPORTE - 1;
const ANIO_HIST_MIN = 2018;
const ANIO_HIST_MAX = ANIO_REPORTE;
// Montos por encima de 10 mil M son basura de carga (1 registro corrupto en 2024):
// se excluyen de las sumas históricas para no distorsionar los totales.
const MONTO_MAX_VALIDO = 1e10;

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

// Lee un filtro de selección múltiple: recoge todas las repeticiones del
// parámetro (?gasera=A&gasera=B), limpia y descarta vacíos.
// Devuelve undefined cuando no hay selección (= Todos).
function parseLista(raw: (string | null)[] | null | undefined, max = 80): string[] | undefined {
  if (!raw) return undefined;
  const vistos = new Set<string>();
  for (const r of raw) {
    if (!r) continue;
    const v = r.trim().slice(0, max);
    if (v !== '') vistos.add(v);
  }
  return vistos.size > 0 ? [...vistos] : undefined;
}

// Agrega una condición `columna = ANY($n)` cuando la lista trae valores.
// pg serializa el arreglo JS como text[], así que un solo parámetro basta.
function empujarLista(params: unknown[], cond: string[], columna: string, valores?: string[]): void {
  const lista = (valores ?? []).map((v) => v.trim()).filter((v) => v !== '');
  if (lista.length === 0) return;
  params.push(lista);
  cond.push(`${columna} = ANY($${params.length})`);
}

const VAL_ANIO = /^\d{4}$/;
const VAL_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseAnio(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!VAL_ANIO.test(v)) return undefined;
  return v;
}

function parseMes(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!VAL_MES.test(v)) return undefined;
  return v;
}

function clampMinMax(desde?: string, hasta?: string): { desde: string; hasta: string } {
  if (desde && hasta && hasta < desde) return { desde: hasta, hasta: desde };
  return { desde: desde ?? `${ANIO_REPORTE}-01-01`, hasta: hasta ?? `${ANIO_REPORTE}-12-31` };
}

export function parseFilters(url: URL): Filters {
  const rango = clampMinMax(parseFecha(url.searchParams.get('desde')), parseFecha(url.searchParams.get('hasta')));
  const contrato = parseTexto(url.searchParams.get('contrato'));
  const gasera = parseLista(url.searchParams.getAll('gasera'), 120);
  const producto = parseLista(url.searchParams.getAll('producto'), 160);
  const estado = parseLista(url.searchParams.getAll('estado'), 80);
  const aseguradora = parseLista(url.searchParams.getAll('aseguradora'), 80);
  const tipo_siniestro = parseLista(url.searchParams.getAll('tipo_siniestro'), 80);
  const clase = parseLista(url.searchParams.getAll('clase'), 40);
  const anio = parseAnio(url.searchParams.get('anio'));
  const mes = parseMes(url.searchParams.get('mes'));
  return { contrato, gasera, producto, estado, aseguradora, tipo_siniestro, clase, anio, mes, desde: rango.desde, hasta: rango.hasta };
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

// ---- Seeds de respaldo para el render del servidor ---------------------------------
// Las paginas .astro piden estos datos ANTES de enviar el HTML, para pintar la
// primera pantalla sin esperas. El problema: si PostgreSQL no responde en ese
// instante, el `await` lanza y Astro aborta el render a mitad de camino. La isla
// de React nunca llega al HTML y el usuario ve una pagina EN BLANCO, sin ningun
// mensaje que explique por que.
//
// Se reprodujo en dev: con el pool frio (5 conexiones) y varias paginas pidiendo
// a la vez, `pg` agotaba su `connectionTimeoutMillis` (10 s) y /detalle salia vacio.
//
// La salida no es dejar de pedir datos en el servidor (eso es lo que hace rapido el
// portal) sino que el fallo degrade con elegancia: si no hay seed, se manda uno
// vacio y la isla, que ya pide los datos en su `useEffect` al montar, los carga
// en el navegador. La pagina SIEMPRE sale; solo se pierde el instante de "datos ya
// listos" y se reemplaza por "datos en ~300 ms".

export const METADATOS_VACIOS: Metadatos = {
  anios: [],
  rangoFechas: { min: null, max: null },
  gaseras: [],
  productos: [],
  estados: [],
  aseguradoras: [],
  tipos_siniestro: [],
  clases: [],
};

export function paginaVacia(size = 10): PaginaTabla {
  return { registros: [], total: 0, page: 1, pageSize: size };
}

// Semilla vacia pero de la FORMA CORRECTA. Importa que sea un objeto valido y no
// `null`: estos componentes hacen `useState<T>(semilla)` y despues leen
// `data.departamentos`, `data.forecast`, etc. Un `null` los reventaria en el
// cliente, que es el mismo fallo que estamos evitando en el servidor.
export const MAPA_VACIO: MapaData = {
  totalNacional: 0,
  totalPagadoNacional: 0,
  departamentos: [],
};

export const HISTORICOS_VACIO: HistoricosData = {
  anios: [],
  mensual: [],
  tendencia: [],
  sinFecha: 0,
};

export const PROYECCION_VACIA: ProyeccionData = {
  anioObjetivo: ANIO_REPORTE,
  aniosEntrenamiento: [],
  forecast: [],
  forecast2026: [],
  estacionalidad: [],
  tendencia: {
    pendienteAnual: 0,
    pValue: 1,
    significante: false,
    direccion: 'estable',
    totalProyAnual: 0,
    montoProyAnual: 0,
    crecimientoVsPrevio: 0,
  },
  departamentos: [],
  tiposSiniestro: [],
  backtest: { mape: null, confiable: false, detalle: [] },
  cambios: [],
  supuestos: [],
};

export const ESTATUS_VACIO: EstatusData = {
  anio: ANIO_REPORTE,
  gaseras: [],
  estados: [],
  filas: [],
};

// El dashboard junta seis consultas en un solo `Promise.all` y las mete en un
// objeto. Con la BD caida, una sola de las seis que falle tumba el grupo entero.
export const KPIS_VACIOS: KpisData = {
  total: 0,
  pagados: 0,
  objetados: 0,
  solicitudDocs: 0,
  enTramite: 0,
  totalPagado: 0,
  sinEstado: 0,
  comparativo: { total2025: 0, total2026: 0, deltaPct: 0 },
};

export const TENDENCIA_VACIA: PuntoTendencia[] = [];
export const POR_ASEGURADORA_VACIA: SerieAseguradora[] = [];
export const POR_GASERA_VACIA: ItemGasera[] = [];
export const POR_PRODUCTO_VACIA: ItemProducto[] = [];
export const POR_TIPO_SINUESTRO_VACIA: ItemTipoSiniestro[] = [];

/**
 * Envuelve una carga de datos del render del servidor. Si falla, devuelve el
 * respaldo y deja rastro en el log en vez de romper la pagina.
 */
export async function cargaSSR<T>(etiqueta: string, promise: Promise<T>, respaldo: T): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.error(`[ssr] ${etiqueta} fallo al cargar el seed del servidor: ${motivo}`);
    return respaldo;
  }
}

// ---- Control manual de la caché ------------------------------------------------
// Se llama desde /api/cache (botón "refrescar" del header) para forzar que la
// siguiente lectura vaya a PostgreSQL en vez de servir un valor stale.
//
// Se descartan TAMBIÉN las promesas en vuelo: si no, una revalidación que ya
// estaba corriendo escribiría su resultado viejo de vuelta en la caché después
// del purgado, y el botón "refrescar" no serviría de nada.
export function purgarCache(): { entradas: number; enVuelo: number; bytesLiberados: number } {
  const entradas = cacheConsultas.size;
  const pendientes = enVuelo.size;
  const bytesLiberados = bytesEnCache;
  cacheConsultas.clear();
  enVuelo.clear();
  bytesEnCache = 0;
  return { entradas, enVuelo: pendientes, bytesLiberados };
}

export function estadisticasCache(): {
  entradas: number;
  maxEntradas: number;
  bytes: number;
  maxBytes: number;
  enVuelo: number;
  suaveTtlMin: number;
  staleTtlMin: number;
  heapMb: number;
} {
  return {
    entradas: cacheConsultas.size,
    maxEntradas: CACHE_MAX_ENTRIES,
    bytes: bytesEnCache,
    maxBytes: CACHE_MAX_BYTES,
    enVuelo: enVuelo.size,
    suaveTtlMin: Math.round(CACHE_SOFT_TTL_MS / 60_000),
    staleTtlMin: Math.round(CACHE_STALE_TTL_MS / 60_000),
    heapMb: Math.round(process.memoryUsage().heapUsed / 1048576),
  };
}

type RowBase = Record<string, unknown>;

// ============================================================================
// CACHÉ EN MEMORIA ULTRA-RÁPIDO CON STALE-WHILE-REVALIDATE
// ----------------------------------------------------------------------------
// 1. Soft TTL (10 min): Datos 100% frescos.
// 2. Stale TTL (30 min): Si pasaron más de 10 min, se sirve de INMEDIATO (<5ms)
//    y se revalida en background sin bloquear la navegación ni la carga.
// 3. Deduplicación en vuelo: múltiples peticiones concurrentes a la misma clave
//    comparten una única promesa hacia PostgreSQL.
//
// ANTES: 15 min frescos / 2 h utilizables stale. Con 2 h, cargar siniestros
// nuevos en la BD y recargar la página NO los mostraba: había que esperar
// hasta 2 horas (o reiniciar el contenedor). 30 min acota ese desfase sin
// castigar la latencia, y /api/cache permite purgar a mano en cualquier
// momento (botón "refrescar" en el header).
// ============================================================================
const CACHE_SOFT_TTL_MS = 10 * 60_000;  // 10 minutos fresco
const CACHE_STALE_TTL_MS = 30 * 60_000; // 30 minutos utilizable stale
const CACHE_MAX_ENTRIES = 300;           // tope de entradas en memoria (LRU)
const CACHE_MAX_BYTES = 24 * 1024 * 1024; // tope de 24 MB: 300 entradas de geodata
                                               // o matrices pesan mucho más que un KPI
const CACHE_SWEEP_MS = 5 * 60_000;       // barrido de expiración cada 5 min

interface EntradaCache<T> {
  t: number;    // cuándo se validó por última vez contra la BD
  last: number; // último acceso (lectura o escritura), para LRU
  bytes: number;// tamaño aproximado del payload, para el tope en MB
  v: T;
}

const cacheConsultas = new Map<string, EntradaCache<unknown>>();
const enVuelo = new Map<string, { t: number; p: Promise<unknown> }>();
let bytesEnCache = 0;

// Tamaño aproximado en bytes. JSON.stringify es nativo y sobre payloads de BD
// cuesta microsegundos; evita tener un tope solo por número de entradas, que
// trataría igual un KPI de 2 KB que un mapa con miles de puntos.
function tamanoAprox(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'string') return v.length * 2;
  try {
    return JSON.stringify(v)?.length ?? 0;
  } catch {
    return 0;
  }
}

function guardar(clave: string, v: unknown): void {
  const anterior = cacheConsultas.get(clave);
  const bytes = tamanoAprox(v);
  if (anterior) bytesEnCache -= anterior.bytes;
  bytesEnCache += bytes;
  cacheConsultas.set(clave, { t: Date.now(), last: Date.now(), bytes, v });
  if (bytesEnCache > CACHE_MAX_BYTES) barrerCache();
}

// Marca un acceso (en branches de lectura) o escritura.
function tocar(clave: string, e: EntradaCache<unknown>): void {
  e.last = Date.now();
  cacheConsultas.set(clave, e);
}

// Evita que la caché crezca sin límite: expulsa entradas con acceso más antiguo
// (least-recently-used) hasta cumplir los dos topes, el de entradas y el de bytes.
function expulsarSiLleno(): void {
  while (
    cacheConsultas.size >= CACHE_MAX_ENTRIES ||
    (bytesEnCache > CACHE_MAX_BYTES && cacheConsultas.size > 0)
  ) {
    let viejaClave: string | null = null;
    let viejoLast = Infinity;
    for (const [k, e] of cacheConsultas) {
      if (e.last < viejoLast) {
        viejoLast = e.last;
        viejaClave = k;
      }
    }
    if (viejaClave == null) return;
    const saliendo = cacheConsultas.get(viejaClave);
    if (saliendo) bytesEnCache -= saliendo.bytes;
    cacheConsultas.delete(viejaClave);
  }
}

// Barrido periódico: descarta entradas sin uso desde hace más de
// CACHE_STALE_TTL_MS. Libera memoria y datos (incluidos los delicados
// que aún puedan quedar) aunque nunca se vuelvan a pedir esas combinaciones.
// También suelta promesas en vuelo que quedaron colgadas.
function barrerCache(): void {
  const ahora = Date.now();
  let libres = 0;
  for (const [k, e] of cacheConsultas) {
    if (ahora - e.last > CACHE_STALE_TTL_MS) {
      bytesEnCache -= e.bytes;
      libres++;
      cacheConsultas.delete(k);
    }
  }
  if (libres) console.log(`[cache] barrido: ${libres} entradas liberadas`);

  // Red de seguridad: una promesa que no se resuelve en 2 min queda huérfana.
  for (const [k, en] of enVuelo) {
    if (ahora - en.t > 2 * 60_000) {
      enVuelo.delete(k);
      console.log(`[cache] promesa en vuelo abandonada: ${k.slice(0, 60)}`);
    }
  }

  if (bytesEnCache > CACHE_MAX_BYTES) expulsarSiLleno();
}

async function conCache<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const ahora = Date.now();
  const hit = cacheConsultas.get(clave);

  // 1. Fresco (< 15 minutos): entrega inmediata
  if (hit && ahora - hit.t < CACHE_SOFT_TTL_MS) {
    tocar(clave, hit);
    return hit.v as T;
  }

  // 2. En rango stale (15 min a 2 horas): servir de inmediato y refrescar en segundo plano
  if (hit && ahora - hit.t < CACHE_STALE_TTL_MS) {
    tocar(clave, hit);
    if (!enVuelo.has(clave)) {
      const p = fn()
        .then((nuevo) => {
          guardar(clave, nuevo);
          enVuelo.delete(clave);
          return nuevo;
        })
        .catch(() => {
          enVuelo.delete(clave);
        });
      enVuelo.set(clave, { t: Date.now(), p });
    }
    return hit.v as T;
  }

  // 3. Sin caché o superó el tiempo stale:
  // Reutilizar promesa en vuelo si existe para no duplicar queries
  const pendiente = enVuelo.get(clave);
  if (pendiente) {
    return pendiente.p as Promise<T>;
  }

  expulsarSiLleno();
  const promesa = fn()
    .then((resultado) => {
      guardar(clave, resultado);
      enVuelo.delete(clave);
      return resultado;
    })
    .catch((err) => {
      enVuelo.delete(clave);
      if (hit) return hit.v as T;
      throw err;
    });

  enVuelo.set(clave, { t: Date.now(), p: promesa });
  return promesa;
}

// Clave de caché estable para un conjunto de filtros (listas ordenadas).
function serializarFiltros(f: Filters | EstatusFiltros): string {
  const ordenado: Record<string, unknown> = {};
  for (const k of Object.keys(f).sort()) {
    const v = (f as Record<string, unknown>)[k];
    if (v === undefined || v === null) continue;
    ordenado[k] = Array.isArray(v) ? [...v].sort() : v;
  }
  return JSON.stringify(ordenado);
}

function construirWhere(f: Filters): { cond: string; params: unknown[] } {
  const cond: string[] = [];
  const params: unknown[] = [];

  // Si se busca un contrato específico, buscar de forma flexible en numero_contrato
  // y campos originales (incluso identificaciones), sin que el rango estricto de fechas lo oculte
  // La fecha que manda es `fecha_efectiva` (radicación o fecha propia del archivo).
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
      cond.push(`fecha_efectiva >= $${params.length - 1}::date AND fecha_efectiva < ($${params.length}::date + interval '1 day')`);
    }
  } else {
    params.push(f.desde, f.hasta);
    cond.push(`fecha_efectiva >= $${params.length - 1}::date AND fecha_efectiva < ($${params.length}::date + interval '1 day')`);
  }

  if (f.clase?.length) {
    empujarLista(params, cond, 'clase_norm', f.clase);
  }

  if (f.gasera?.length) {
    empujarLista(params, cond, 'gasera_norm', f.gasera);
  }
  if (f.producto?.length) {
    empujarLista(params, cond, 'producto_norm', f.producto);
  }
  if (f.estado?.length) {
    empujarLista(params, cond, 'estado_norm', f.estado);
  }
  if (f.aseguradora?.length) {
    empujarLista(params, cond, 'aseguradora_norm', f.aseguradora);
  }
  if (f.tipo_siniestro?.length) {
    empujarLista(params, cond, 'tipo_siniestro_norm', f.tipo_siniestro);
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
        COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado' AND monto <= ${MONTO_MAX_VALIDO}), 0)::numeric AS total_pagado
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
      SELECT ${FECHA_EFECTIVA_SQL} AS fecha_efectiva, ${GASERA_SQL} AS gasera_norm
      FROM siniestros.casos c
      WHERE c.vigente
        AND c.nombre_archivo_origen NOT ILIKE '%planilla%'
    ) sub
    WHERE sub.fecha_efectiva BETWEEN $1::date AND $2::date AND sub.gasera_norm <> 'Promigas'
    `,
    [`${anio}-01-01`, `${anio}-12-31`],
  );
  return r ? Number(r.n) : null;
}

// ---- Tendencia mensual --------------------------------------------------------
// Con filtro `mes` activo la serie baja a granularidad de DÍA (1..último día
// del mes) para que el gráfico muestre cómo va el mes; sin filtro vuelve a
// los meses del rango. `dia` en el punto marca el modo día.
export async function getTendencia(f: Filters): Promise<PuntoTendencia[]> {
  return conCache(`tendencia:${serializarFiltros(f)}`, async () => {
  const w = construirWhere(f);
  if (f.mes) {
    const sqlDia = `
      WITH base AS (${BASE})
      SELECT EXTRACT(DAY FROM fecha_efectiva)::int AS dia,
             count(*)::int            AS total,
             COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado'), 0)::numeric AS valor
      FROM base
      WHERE ${w.cond}
      GROUP BY 1 ORDER BY 1
    `;
    const rowsDia = await query<{ dia: number; total: number; valor: string }>(sqlDia, w.params);
    return rellenarDias(f.mes, rowsDia);
  }
  const sql = `
    WITH base AS (${BASE})
    SELECT to_char(date_trunc('month', fecha_efectiva), 'YYYY-MM') AS mes,
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

// Último día real de un mes (respeta años bisiestos).
function ultimoDiaMes(mes: string): number {
  const [yy, mm] = mes.split('-').map(Number);
  if (!yy || !mm || mm < 1 || mm > 12) return 31;
  return new Date(yy, mm, 0).getDate();
}

// Rellena 1..último día del mes filtrado con 0 en los días sin casos.
function rellenarDias(mes: string, rows: { dia: number; total: number; valor: string }[]): PuntoTendencia[] {
  const mapa = new Map(rows.map((r) => [Number(r.dia), r]));
  const n = ultimoDiaMes(mes);
  const out: PuntoTendencia[] = [];
  for (let d = 1; d <= n; d += 1) {
    const r = mapa.get(d);
    out.push({
      mes: `${mes}-${String(d).padStart(2, '0')}`,
      label: String(d),
      dia: d,
      total: r ? Number(r.total) : 0,
      valorPagado: r ? Number(r.valor) : 0,
    });
  }
  return out;
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
    SELECT to_char(date_trunc('month', fecha_efectiva), 'YYYY-MM') AS mes,
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

// ---- Por tipo de siniestro (apropiar top + Otros) -------------------------------
export async function getPorTipoSiniestro(f: Filters, top = 6): Promise<ItemTipoSiniestro[]> {
  return conCache(`por-tipo-siniestro:${serializarFiltros(f)}:${top}`, async () => {
  const w = construirWhere(f);
  const sql = `
    WITH base AS (${BASE})
    SELECT tipo_siniestro_norm AS tipo_siniestro, count(*)::int AS total
    FROM base
    WHERE ${w.cond}
    GROUP BY 1 ORDER BY total DESC, tipo_siniestro ASC
  `;
  const rows = await query<ItemTipoSiniestro>(sql, w.params);
  const cabecera = rows.slice(0, top);
  const resto = rows.slice(top).reduce((acc, r) => acc + Number(r.total), 0);
  return resto > 0 ? [...cabecera, { tipo_siniestro: 'Otros', total: resto }] : cabecera;
  });
}

// ---- Tabla de detalle (paginada) ----------------------------------------------
// Las filas contienen datos personales (contrato, nombre del asegurado, monto):
// NUNCA se cachean en memoria. Sólo se cachea el total filtrado (agregado,
// sin datos personales); las páginas se consultan a BD bajo demanda.
const CAMPOS_TABLA = `
  id_caso, numero_contrato, nombre_asegurado,
  fecha_efectiva AS fecha_radicacion,
  aseguradora_norm AS aseguradora,
  gasera_norm AS gasera,
  producto_norm AS producto,
  clase_norm AS clase,
  estado_norm AS estado,
  monto
`;

export async function getTabla(f: Filters, page: number, pageSize: number): Promise<PaginaTabla> {
  const w = construirWhere(f);
  const total = await conCache(`tabla-total:${serializarFiltros(f)}`, async () => {
    const totalRow = await queryOne<{ n: number }>(
      `WITH base AS (${BASE}) SELECT count(*)::int AS n FROM base WHERE ${w.cond}`, w.params,
    );
    return Number(totalRow ? totalRow.n : 0);
  });
  const off = (page - 1) * pageSize;
  const sql = `
    WITH base AS (${BASE})
    SELECT ${CAMPOS_TABLA}
    FROM base
    WHERE ${w.cond}
    ORDER BY fecha_efectiva DESC NULLS LAST, id_caso DESC
    LIMIT $${w.params.length + 1} OFFSET $${w.params.length + 2}
  `;
  const filas = await query<RegistroTabla>(sql, [...w.params, pageSize, off]);
  return {
    registros: mapearFilasTabla(filas),
    total,
    page,
    pageSize,
  };
}

// Normaliza los tipos que entrega pg (numeric → number, null → cadena vacía).
function mapearFilasTabla(filas: RegistroTabla[]): RegistroTabla[] {
  return filas.map((r) => ({
    id_caso: Number(r.id_caso),
    numero_contrato: r.numero_contrato,
    nombre_asegurado: r.nombre_asegurado,
    aseguradora: r.aseguradora ?? '',
    gasera: r.gasera ?? '',
    producto: r.producto ?? '',
    clase: r.clase ?? '',
    estado: r.estado ?? '',
    fecha_radicacion: r.fecha_radicacion,
    monto: r.monto == null ? null : Number(r.monto),
  }));
}

// ---- Exportación del detalle (servidor) ----------------------------------------
// El .xlsx se arma en el servidor con UNA sola consulta (sin paginación en el
// navegador): el cliente antes encadenaba cientos de peticiones a /api/tabla, lo
// que agotaba el rate limit de la API (429) y saturaba la DB compartida (53300).
export const LIMITE_EXPORT_FILAS = 50_000;

export interface DetalleExport {
  registros: RegistroTabla[];
  total: number;
  truncado: boolean;
}

export async function getDetalleExport(
  f: Filters,
  offset: number,
  limite: number,
): Promise<DetalleExport> {
  const w = construirWhere(f);
  const total = await conCache(`tabla-total:${serializarFiltros(f)}`, async () => {
    const totalRow = await queryOne<{ n: number }>(
      `WITH base AS (${BASE}) SELECT count(*)::int AS n FROM base WHERE ${w.cond}`, w.params,
    );
    return Number(totalRow ? totalRow.n : 0);
  });
  const top = Math.max(1, Math.min(Math.floor(limite) || LIMITE_EXPORT_FILAS, LIMITE_EXPORT_FILAS));
  const off = Math.max(0, Math.floor(offset) || 0);
  const sql = `
    WITH base AS (${BASE})
    SELECT ${CAMPOS_TABLA}
    FROM base
    WHERE ${w.cond}
    ORDER BY fecha_efectiva DESC NULLS LAST, id_caso DESC
    LIMIT $${w.params.length + 1} OFFSET $${w.params.length + 2}
  `;
  const filas = await query<RegistroTabla>(sql, [...w.params, top, off]);
  return {
    registros: mapearFilasTabla(filas),
    total,
    truncado: off + filas.length < total,
  };
}

// ---- Metadatos para poblar los filtros ----------------------------------------
export async function getMetadatos(f: Filters): Promise<Metadatos> {
  return conCache(`metadatos:${serializarFiltros(f)}`, async () => {
    const w = construirWhere(f);
    const sql = `
      WITH base AS (${BASE}),
      filtrado AS (
        SELECT gasera_norm, producto_norm, estado_norm, aseguradora_norm, fecha_efectiva, tipo_siniestro_norm, clase_norm
        FROM base
        WHERE ${w.cond}
      )
      SELECT
        (SELECT json_agg(g.gasera) FROM (SELECT DISTINCT gasera_norm AS gasera FROM filtrado WHERE gasera_norm IS NOT NULL ORDER BY 1) g) AS gaseras,
        (SELECT json_agg(p.producto) FROM (SELECT DISTINCT producto_norm AS producto FROM filtrado WHERE producto_norm IS NOT NULL ORDER BY 1) p) AS productos,
        (SELECT json_agg(e) FROM (SELECT COALESCE(estado_norm,'Sin estado') AS estado, count(*)::int AS total FROM filtrado GROUP BY 1 ORDER BY total DESC) e) AS estados,
        (SELECT json_agg(a.aseguradora) FROM (SELECT DISTINCT aseguradora_norm AS aseguradora FROM filtrado ORDER BY 1) a) AS aseguradoras,
        (SELECT json_agg(t) FROM (SELECT COALESCE(btrim(tipo_siniestro_norm),'Sin tipo') AS tipo_siniestro, count(*)::int AS total FROM filtrado GROUP BY 1 ORDER BY total DESC) t) AS tipos_siniestro,
        (SELECT json_agg(c.clase) FROM (SELECT DISTINCT clase_norm AS clase FROM filtrado WHERE clase_norm IS NOT NULL ORDER BY 1) c) AS clases,
        min(fecha_efectiva) AS min_fecha,
        max(fecha_efectiva) AS max_fecha
      FROM filtrado
    `;
    const [row, aniosR] = await Promise.all([
      queryOne<{
        gaseras: string[] | null;
        productos: string[] | null;
        estados: { estado: string; total: number }[] | null;
        aseguradoras: string[] | null;
        tipos_siniestro: { tipo_siniestro: string; total: number }[] | null;
        clases: string[] | null;
        min_fecha: string | null;
        max_fecha: string | null;
      }>(sql, w.params),
      query<{ anio: number }>(
        `SELECT DISTINCT EXTRACT(YEAR FROM sub.fecha_efectiva)::int AS anio
        FROM (
          SELECT ${FECHA_EFECTIVA_SQL} AS fecha_efectiva, ${GASERA_SQL} AS gasera_norm
FROM siniestros.casos c
      WHERE c.vigente
        AND c.nombre_archivo_origen NOT ILIKE '%planilla%'
    ) sub
    WHERE sub.fecha_efectiva IS NOT NULL AND sub.gasera_norm <> 'Promigas'
        ORDER BY 1 DESC`,
      ),
    ]);

    return {
      gaseras: row?.gaseras ?? [],
      productos: row?.productos ?? [],
      estados: (row?.estados ?? []).map((e) => ({ estado: e.estado, total: Number(e.total) })),
      aseguradoras: row?.aseguradoras ?? [],
      tipos_siniestro: (row?.tipos_siniestro ?? []).map((t) => ({ tipo_siniestro: t.tipo_siniestro, total: Number(t.total) })),
      clases: row?.clases ?? [],
      anios: aniosR.map((r) => Number(r.anio)),
      rangoFechas: { min: aISO(row?.min_fecha), max: aISO(row?.max_fecha) },
    };
  });
}

// ---- Estatus de siniestros por gasera y mes (matriz) --------------------------
export interface EstatusFiltros {
  anio: number;
  gasera?: string[];
  producto?: string[];
  aseguradora?: string[];
  clase?: string[];
  estado?: string[];
}

export async function getEstatus(ef: EstatusFiltros): Promise<EstatusData> {
  return conCache(`estatus:${serializarFiltros(ef)}`, async () => {
  const cond: string[] = [];
  const params: unknown[] = [`${ef.anio}-01-01`, `${ef.anio}-12-31`];
  cond.push('fecha_efectiva >= $1::date AND fecha_efectiva <= $2::date');
  if (ef.gasera?.length) {
    empujarLista(params, cond, 'gasera_norm', ef.gasera);
  }
  if (ef.producto?.length) {
    empujarLista(params, cond, 'producto_norm', ef.producto);
  }
  if (ef.aseguradora?.length) {
    empujarLista(params, cond, 'aseguradora_norm', ef.aseguradora);
  }
  if (ef.clase?.length) {
    empujarLista(params, cond, 'clase_norm', ef.clase);
  }
  if (ef.estado?.length) {
    empujarLista(params, cond, 'estado_norm', ef.estado);
  }
  const sql = `
    WITH base AS (${BASE})
    SELECT COALESCE(gasera_norm,'Sin gasera') AS gasera,
           COALESCE(estado_norm,'Sin estado')   AS estado,
           EXTRACT(MONTH FROM fecha_efectiva)::int AS mes,
           count(*)::int AS total
    FROM base
    WHERE ${cond.join(' AND ')}
    GROUP BY 1, 2, 3 ORDER BY 1, 2, 3
  `;
  const rows = await query<FilaEstatus>(sql, params);
  const mapa = new Map<string, number[]>();
  const mapaEstados = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!mapa.has(r.gasera)) mapa.set(r.gasera, Array.from({ length: 12 }, () => 0));
    const idx = (r.mes - 1) % 12;
    const fila = mapa.get(r.gasera);
    if (fila !== undefined) {
      fila[idx] = fila[idx]! + r.total;
    }
    if (!mapaEstados.has(r.gasera)) mapaEstados.set(r.gasera, new Map());
    const em = mapaEstados.get(r.gasera)!;
    em.set(r.estado, (em.get(r.estado) ?? 0) + r.total);
  }
  const gaseras = [...mapa.keys()].sort((a, b) => {
    const ta = mapa.get(a)!.reduce((s, n) => s + n, 0);
    const tb = mapa.get(b)!.reduce((s, n) => s + n, 0);
    return tb - ta;
  });
  const estados = [...mapaEstados.keys()].sort((a, b) => {
    const ta = mapaEstados.get(a)!.values().reduce((s, n) => s + n, 0);
    const tb = mapaEstados.get(b)!.values().reduce((s, n) => s + n, 0);
    return tb - ta;
  });
  return {
    anio: ef.anio,
    gaseras,
    estados,
    filas: rows.map((r) => ({ gasera: r.gasera, estado: r.estado, mes: Number(r.mes), total: Number(r.total) })),
  };
  });
}

// ---- Histórico anual (tendencia por años) --------------------------------------
// Agrupa por año (2018–2026) con la misma BASE y filtros dimensionales
// (gasera, aseguradora, producto, anio, mes). Los montos > MONTO_MAX_VALIDO se
// excluyen de las sumas (dato corrupto), pero los conteos se mantienen.
// Además calcula la tendencia mensual agregada (siniestros + dinero pagado
// por mes calendario) para el panel inferior de la vista.
export async function getHistoricos(f: Filters): Promise<HistoricosData> {
  const rel = serializarFiltros({
    anio: f.anio, mes: f.mes, gasera: f.gasera, aseguradora: f.aseguradora, producto: f.producto, clase: f.clase,
  });
  return conCache(`historicos:${rel}`, async () => {
    const cond: string[] = [
      'fecha_efectiva IS NOT NULL',
      'EXTRACT(YEAR FROM fecha_efectiva) BETWEEN $1 AND $2',
    ];
    const params: unknown[] = [ANIO_HIST_MIN, ANIO_HIST_MAX];
    if (f.anio) {
      params.push(Number(f.anio));
      cond.push('EXTRACT(YEAR FROM fecha_efectiva) = $' + params.length);
    }
    if (f.mes) {
      params.push(f.mes);
      cond.push(`to_char(date_trunc('month', fecha_efectiva), 'YYYY-MM') = $${params.length}`);
    }
    if (f.gasera?.length) {
      empujarLista(params, cond, 'gasera_norm', f.gasera);
    }
    if (f.producto?.length) {
      empujarLista(params, cond, 'producto_norm', f.producto);
    }
    if (f.aseguradora?.length) {
      empujarLista(params, cond, 'aseguradora_norm', f.aseguradora);
    }
    if (f.clase?.length) {
      empujarLista(params, cond, 'clase_norm', f.clase);
    }
    const sql = `
      WITH base AS (${BASE})
      SELECT EXTRACT(YEAR FROM fecha_efectiva)::int AS anio,
             count(*)::int AS total,
             count(*) FILTER (WHERE estado_norm = 'Pagado')::int AS pagados,
             count(*) FILTER (WHERE estado_norm = 'Objetado')::int AS objetados,
             COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado' AND monto <= ${MONTO_MAX_VALIDO}), 0)::numeric AS total_pagado
      FROM base
      WHERE ${cond.join(' AND ')}
      GROUP BY 1 ORDER BY 1
    `;
    const [rows, filasMensuales, filasTendencia, sinFechaR, filasDiarias] = await Promise.all([
      query<{ anio: number; total: number; pagados: number; objetados: number; total_pagado: string }>(sql, params),
      query<{ anio: number; mes: number; total: number }>(
        `WITH base AS (${BASE})
         SELECT EXTRACT(YEAR FROM fecha_efectiva)::int AS anio,
                EXTRACT(MONTH FROM fecha_efectiva)::int AS mes,
                count(*)::int AS total
         FROM base
         WHERE ${cond.join(' AND ')}
         GROUP BY 1, 2 ORDER BY 1, 2`,
        params,
      ),
      query<{ anio: number; mes: number; total: number; valor: string }>(
        `WITH base AS (${BASE})
         SELECT EXTRACT(YEAR FROM fecha_efectiva)::int AS anio,
                EXTRACT(MONTH FROM fecha_efectiva)::int AS mes,
                count(*)::int AS total,
                COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado' AND monto <= ${MONTO_MAX_VALIDO}), 0)::numeric AS valor
         FROM base
         WHERE ${cond.join(' AND ')}
         GROUP BY 1, 2 ORDER BY 1, 2`,
        params,
      ),
      (async () => {
        const condSF: string[] = ['fecha_efectiva IS NULL'];
        const paramsSF: unknown[] = [];
        if (f.gasera?.length) { empujarLista(paramsSF, condSF, 'gasera_norm', f.gasera); }
        if (f.producto?.length) { empujarLista(paramsSF, condSF, 'producto_norm', f.producto); }
        if (f.aseguradora?.length) { empujarLista(paramsSF, condSF, 'aseguradora_norm', f.aseguradora); }
        if (f.clase?.length) { empujarLista(paramsSF, condSF, 'clase_norm', f.clase); }
        return queryOne<{ n: number }>(
          `WITH base AS (${BASE}) SELECT count(*)::int AS n FROM base WHERE ${condSF.join(' AND ')}`,
          paramsSF,
        );
      })(),
      // Solo con filtro mes: serie diaria del mes (agrega el mismo día de
      // todos los años del rango) para la tendencia en granularidad de día.
      f.mes
        ? query<{ dia: number; total: number; valor: string }>(
            `WITH base AS (${BASE})
             SELECT EXTRACT(DAY FROM fecha_efectiva)::int AS dia,
                    count(*)::int AS total,
                    COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado' AND monto <= ${MONTO_MAX_VALIDO}), 0)::numeric AS valor
             FROM base
             WHERE ${cond.join(' AND ')}
             GROUP BY 1 ORDER BY 1`,
            params,
          )
        : Promise.resolve([] as { dia: number; total: number; valor: string }[]),
    ]);
    const mapa = new Map(rows.map((r) => [Number(r.anio), r]));
    const anios: AnioHist[] = [];
    const mensual: SerieMensualAnio[] = [];
    for (let y = ANIO_HIST_MIN; y <= ANIO_HIST_MAX; y += 1) {
      if (f.anio && Number(f.anio) !== y) continue;
      // Solo el último año del rango (en curso) es parcial; los anteriores
      // están cerrados y sus meses sin casos son ceros reales.
      const esAnioParcial = y === ANIO_HIST_MAX;
      const r = mapa.get(y);
      const total = r ? Number(r.total) : 0;
      const pagados = r ? Number(r.pagados) : 0;
      anios.push({
        anio: y,
        total,
        pagados,
        objetados: r ? Number(r.objetados) : 0,
        porcPagado: total > 0 ? Math.round((pagados / total) * 1000) / 10 : 0,
        totalPagado: r ? Number(r.total_pagado) : 0,
      });
      const meses: (number | null)[] = Array(12).fill(esAnioParcial ? null : 0);
      for (const fm of filasMensuales) {
        if (Number(fm.anio) === y) meses[Number(fm.mes) - 1] = Number(fm.total);
      }
      if (esAnioParcial) {
        // El año en curso es parcial: los meses posteriores al último con
        // dato quedan en null para que la línea se corte (no caiga a cero).
        const maxMesObs = filasMensuales.reduce(
          (m, fm) => (Number(fm.anio) === y ? Math.max(m, Number(fm.mes)) : m),
          0,
        );
        for (let m = maxMesObs; m < 12; m += 1) meses[m] = null;
      }
      mensual.push({ anio: y, meses });
    }
    const tendencia = armarTendenciaMes(filasTendencia, f, filasDiarias);
    return { anios, mensual, tendencia, sinFecha: Number(sinFechaR?.n ?? 0) };
  });
}

const MESES_CORTOS_HIST = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Tendencia mensual agregada por mes calendario (siniestros + dinero pagado):
// - Con filtro mes: desglose POR DÍA de ese mes (1..último día), agregando el
//   mismo día de todos los años del rango.
// - Con filtro del año en curso (2026): se corta en el último mes con dato.
// - Años cerrados o sin filtro (agregado de todos los años): los 12 meses.
function armarTendenciaMes(
  rows: { anio: number; mes: number; total: number; valor: string }[],
  f: Filters,
  filasDiarias?: { dia: number; total: number; valor: string }[],
): PuntoMesHist[] {
  if (f.mes) {
    const n = ultimoDiaMes(f.mes);
    const mapa = new Map((filasDiarias ?? []).map((r) => [Number(r.dia), r]));
    const out: PuntoMesHist[] = [];
    for (let d = 1; d <= n; d += 1) {
      const r = mapa.get(d);
      out.push({
        mes: d,
        label: String(d),
        dia: d,
        total: r ? Number(r.total) : 0,
        valorPagado: r ? Number(r.valor) : 0,
      });
    }
    return out;
  }
  // Las filas vienen por (anio, mes): se suman por mes calendario para
  // agregar todos los años cuando no hay filtro de año.
  const agg = new Map<number, { total: number; valor: number }>();
  for (const r of rows) {
    const m = Number(r.mes);
    const e = agg.get(m) ?? { total: 0, valor: 0 };
    e.total += Number(r.total);
    e.valor += Number(r.valor);
    agg.set(m, e);
  }
  const ultimo = rows.reduce((mx, r) => Math.max(mx, Number(r.mes)), 0);
  const anioSel = f.anio ? Number(f.anio) : null;
  let corte: number;
  if (anioSel !== null && anioSel < ANIO_HIST_MAX) corte = 12;
  else if (anioSel === ANIO_HIST_MAX) corte = ultimo;
  else corte = rows.some((r) => Number(r.anio) < ANIO_HIST_MAX) ? 12 : ultimo;
  const out: PuntoMesHist[] = [];
  for (let m = 1; m <= Math.max(0, corte); m += 1) {
    const r = agg.get(m);
    out.push({
      mes: m,
      label: MESES_CORTOS_HIST[m - 1] ?? String(m),
      total: r ? r.total : 0,
      valorPagado: r ? r.valor : 0,
    });
  }
  return out;
}

// ---- Proyección estadística (forecast del próximo año) -------------------------
// Entrena SOLO con años cerrados (2018–2025): el año en curso parcial se
// excluye para no contaminar la estacionalidad. Respeta los filtros
// dimensionales (gasera, producto, aseguradora). Ver src/lib/estadistica.ts
// para la metodología (seasonal-naive + drift Theil-Sen, bandas p10/p90,
// Laplace + Wilson, chi-cuadrado, backtesting walk-forward).
const ANIO_ENTRENA_MAX = ANIO_PREVIO; // 2025: último año cerrado
const ANIO_OBJETIVO = ANIO_REPORTE + 1; // 2027
const ANIO_CORTE_CAMBIO = 2022; // temprano 2018–2022 vs reciente 2023–2025

export async function getProyeccion(f: Filters): Promise<ProyeccionData> {
  const rel = serializarFiltros({ gasera: f.gasera, producto: f.producto, aseguradora: f.aseguradora, clase: f.clase });
  return conCache(`proyeccion:${rel}`, async () => {
    const cond: string[] = [
      'fecha_efectiva IS NOT NULL',
      'EXTRACT(YEAR FROM fecha_efectiva) BETWEEN $1 AND $2',
    ];
    const params: unknown[] = [ANIO_HIST_MIN, ANIO_ENTRENA_MAX];
    if (f.gasera?.length) {
      empujarLista(params, cond, 'gasera_norm', f.gasera);
    }
    if (f.producto?.length) {
      empujarLista(params, cond, 'producto_norm', f.producto);
    }
    if (f.aseguradora?.length) {
      empujarLista(params, cond, 'aseguradora_norm', f.aseguradora);
    }
    if (f.clase?.length) {
      empujarLista(params, cond, 'clase_norm', f.clase);
    }
    const where = cond.join(' AND ');
    // Mismos filtros dimensionales pero apuntando al año en curso (2026) para
    // el cierre real; el `where` principal corta en 2018–2025 (entrenamiento).
    const cond2026: string[] = ['fecha_efectiva IS NOT NULL', 'EXTRACT(YEAR FROM fecha_efectiva) = ' + ANIO_REPORTE];
    const params2026: unknown[] = [];
    if (f.gasera?.length) {
      empujarLista(params2026, cond2026, 'gasera_norm', f.gasera);
    }
    if (f.producto?.length) {
      empujarLista(params2026, cond2026, 'producto_norm', f.producto);
    }
    if (f.aseguradora?.length) {
      empujarLista(params2026, cond2026, 'aseguradora_norm', f.aseguradora);
    }
    if (f.clase?.length) {
      empujarLista(params2026, cond2026, 'clase_norm', f.clase);
    }
    const where2026 = cond2026.join(' AND ');
    const corte = `CASE WHEN EXTRACT(YEAR FROM fecha_efectiva) <= ${ANIO_CORTE_CAMBIO} THEN 'temprano' ELSE 'reciente' END`;
    const [mensual, deptos, tipos, tiposPeriodo, deptosPeriodo, reales2026] = await Promise.all([
      query<{ anio: number; mes: number; total: number; valor: string }>(
        `WITH base AS (${BASE})
         SELECT EXTRACT(YEAR FROM fecha_efectiva)::int AS anio,
                EXTRACT(MONTH FROM fecha_efectiva)::int AS mes,
                count(*)::int AS total,
                COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado' AND monto <= ${MONTO_MAX_VALIDO}), 0)::numeric AS valor
         FROM base
         WHERE ${where}
         GROUP BY 1, 2 ORDER BY 1, 2`,
        params,
      ),
      query<{ nombre: string; total: number }>(
        `WITH base AS (${BASE})
         SELECT COALESCE(departamento_norm,'Sin departamento') AS nombre, count(*)::int AS total
         FROM base
         WHERE ${where}
         GROUP BY 1 ORDER BY total DESC`,
        params,
      ),
      query<{ nombre: string; total: number }>(
        `WITH base AS (${BASE})
         SELECT tipo_siniestro_norm AS nombre, count(*)::int AS total
         FROM base
         WHERE ${where}
         GROUP BY 1 ORDER BY total DESC`,
        params,
      ),
      query<{ nombre: string; periodo: string; total: number }>(
        `WITH base AS (${BASE})
         SELECT tipo_siniestro_norm AS nombre, ${corte} AS periodo, count(*)::int AS total
         FROM base
         WHERE ${where}
         GROUP BY 1, 2`,
        params,
      ),
      query<{ nombre: string; periodo: string; total: number }>(
        `WITH base AS (${BASE})
         SELECT COALESCE(departamento_norm,'Sin departamento') AS nombre, ${corte} AS periodo, count(*)::int AS total
         FROM base
         WHERE ${where}
         GROUP BY 1, 2`,
        params,
      ),
      // Reales 2026 mes a mes (siniestros + pagado) para el cierre del año.
      query<{ mes: number; total: number; valor: string }>(
        `WITH base AS (${BASE})
         SELECT EXTRACT(MONTH FROM fecha_efectiva)::int AS mes,
                count(*)::int AS total,
                COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado' AND monto <= ${MONTO_MAX_VALIDO}), 0)::numeric AS valor
         FROM base
         WHERE ${where2026}
         GROUP BY 1 ORDER BY 1`,
        params2026,
      ),
    ]);

    const filas: MesEntrenamiento[] = mensual.map((r) => ({
      anio: Number(r.anio),
      mes: Number(r.mes),
      total: Number(r.total),
      valor: Number(r.valor),
    }));
    const aniosEntrenamiento = [...new Set(filas.map((r) => r.anio))].sort((a, b) => a - b);

    const pron = pronosticar(filas, ANIO_OBJETIVO);
    const anuales = aniosEntrenamiento.map((y) =>
      filas.filter((r) => r.anio === y).reduce((s, r) => s + r.total, 0),
    );
    const pendiente = aniosEntrenamiento.length >= 2 ? theilSen(aniosEntrenamiento, anuales) : 0;
    const mk = mannKendall(anuales);
    const significante = mk.p < 0.05;
    const direccion: TendenciaProy['direccion'] = !significante
      ? 'estable'
      : pendiente > 0
        ? 'alza'
        : pendiente < 0
          ? 'baja'
          : 'estable';
    const totalProyAnual = pron.reduce((s, p) => s + p.siniestros, 0);
    const montoProyAnual = pron.reduce((s, p) => s + p.monto, 0);
    const previoAnual = anuales.length > 0 ? anuales[anuales.length - 1] ?? 0 : 0;
    const crecimiento = previoAnual > 0
      ? Math.round(((totalProyAnual - previoAnual) / previoAnual) * 1000) / 10
      : 0;

    const mapaRealPrevio = new Map(
      filas.filter((r) => r.anio === ANIO_ENTRENA_MAX).map((r) => [r.mes, r.total]),
    );
    const forecast: PuntoForecast[] = pron.map((p) => ({
      mes: p.mes,
      label: MESES_CORTOS_HIST[p.mes - 1] ?? String(p.mes),
      siniestros: p.siniestros,
      sinLow: p.sinLow,
      sinHigh: p.sinHigh,
      monto: p.monto,
      montoLow: p.montoLow,
      montoHigh: p.montoHigh,
      refAnioPrevio: mapaRealPrevio.get(p.mes) ?? 0,
    }));

    // Cierre 2026 (12 meses): meses reales observados en la BD + meses
    // restantes proyectados con el mismo motor (pasos=1). El separador
    // real→proyectado se marca con `proyectado` en cada punto.
    const pron2026 = pronosticar(filas, ANIO_REPORTE);
    const mapaReal2026 = new Map(reales2026.map((r) => [Number(r.mes), r]));
    const ultimoMesReal = reales2026.reduce((mx, r) => Math.max(mx, Number(r.mes)), 0);
    const forecast2026: PuntoForecast[] = pron2026.map((p) => {
      const real = mapaReal2026.get(p.mes);
      const esReal = p.mes <= ultimoMesReal && real !== undefined;
      const sin = esReal ? Number(real?.total ?? 0) : p.siniestros;
      const monto2026 = esReal ? Number(real?.valor ?? 0) : p.monto;
      return {
        mes: p.mes,
        label: MESES_CORTOS_HIST[p.mes - 1] ?? String(p.mes),
        siniestros: sin,
        sinLow: esReal ? sin : p.sinLow,
        sinHigh: esReal ? sin : p.sinHigh,
        monto: monto2026,
        montoLow: esReal ? monto2026 : p.montoLow,
        montoHigh: esReal ? monto2026 : p.montoHigh,
        refAnioPrevio: mapaRealPrevio.get(p.mes) ?? 0,
        proyectado: !esReal,
      };
    });

    const estacionalidad: IndiceEstacional[] = indicesEstacionales(filas).map((e) => ({
      mes: e.mes,
      label: MESES_CORTOS_HIST[e.mes - 1] ?? String(e.mes),
      indice: e.indice,
      low: e.low,
      high: e.high,
    }));

    const departamentos: ProbItem[] = distribucion(
      deptos.map((r) => ({ nombre: r.nombre, casos: Number(r.total) })),
    ).slice(0, 8);
    const tiposSiniestro: ProbItem[] = distribucion(
      tipos.map((r) => ({ nombre: r.nombre, casos: Number(r.total) })),
    ).slice(0, 8);

    const alinearPeriodos = (rows: { nombre: string; periodo: string; total: number }[]) => {
      const nombres = [...new Set(rows.map((r) => r.nombre))];
      const suma = (n: string, per: string) =>
        rows.filter((r) => r.nombre === n && r.periodo === per).reduce((s, r) => s + Number(r.total), 0);
      return chiCuadradoP(nombres.map((n) => suma(n, 'temprano')), nombres.map((n) => suma(n, 'reciente')));
    };
    const redondearP = (p: number) => Math.round(p * 10000) / 10000;
    const chiTipos = alinearPeriodos(tiposPeriodo);
    const chiDeptos = alinearPeriodos(deptosPeriodo);
    const cambios: CambioEstructural[] = [
      { dimension: 'Tipo de siniestro', pValue: redondearP(chiTipos.p), hayCambio: chiTipos.p < 0.05 },
      { dimension: 'Departamento', pValue: redondearP(chiDeptos.p), hayCambio: chiDeptos.p < 0.05 },
    ];

    const bt = backtest(filas, [ANIO_ENTRENA_MAX - 1, ANIO_ENTRENA_MAX]);
    const backtestInfo: BacktestInfo = {
      mape: bt.mape,
      confiable: bt.mape !== null && bt.mape <= 25,
      detalle: bt.detalle,
    };

    const primerAnio = aniosEntrenamiento[0] ?? ANIO_HIST_MIN;
    const ultimoAnio = aniosEntrenamiento[aniosEntrenamiento.length - 1] ?? ANIO_ENTRENA_MAX;
    const supuestos = [
      `Entrenamiento con ${aniosEntrenamiento.length} años cerrados (${primerAnio}–${ultimoAnio}); 2026 parcial excluido.`,
      `Seasonal-naive proporcional + drift Theil-Sen (${pendiente >= 0 ? '+' : ''}${Math.round(pendiente)} casos/año).`,
      'Bandas 80% desde residuos relativos históricos (p10/p90 pooled).',
      'Probabilidades suavizadas Laplace; intervalos Wilson 95%.',
      'Montos > $10.000 M excluidos (dato corrupto); Promigas excluido.',
      `Precisión walk-forward MAPE ${bt.mape !== null ? `${bt.mape}%` : 'n/d'} (${ANIO_ENTRENA_MAX - 1}–${ANIO_ENTRENA_MAX}).`,
    ];

    return {
      anioObjetivo: ANIO_OBJETIVO,
      aniosEntrenamiento,
      forecast,
      forecast2026,
      estacionalidad,
      tendencia: {
        pendienteAnual: Math.round(pendiente * 10) / 10,
        pValue: redondearP(mk.p),
        significante,
        direccion,
        totalProyAnual,
        montoProyAnual,
        crecimientoVsPrevio: crecimiento,
      },
      departamentos,
      tiposSiniestro,
      backtest: backtestInfo,
      cambios,
      supuestos,
    };
  });
}

// ---- Mapa geográfico de siniestros (por departamento y municipios) ------------
export async function getMapa(f: Filters): Promise<MapaData> {
  return conCache(`mapa:${serializarFiltros(f)}`, async () => {
  const w = construirWhere(f);
  const sql = `
    WITH base AS (${BASE}),
    filtrado AS (
      SELECT
        departamento_norm AS departamento,
        municipio_norm AS municipio,
        estado_norm,
        monto
      FROM base
      WHERE ${w.cond}
    ),
    deptos AS (
      SELECT
        departamento,
        count(*)::int AS total,
        count(*) FILTER (WHERE estado_norm = 'Pagado')::int AS pagados,
        count(*) FILTER (WHERE estado_norm = 'En trámite')::int AS en_tramite,
        count(*) FILTER (WHERE estado_norm = 'Objetado')::int AS objetados,
        COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado'), 0)::numeric AS total_pagado
      FROM filtrado
      GROUP BY 1
    ),
    muns AS (
      SELECT
        departamento,
        municipio,
        count(*)::int AS total,
        COALESCE(sum(monto) FILTER (WHERE estado_norm = 'Pagado'), 0)::numeric AS pagado
      FROM filtrado
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

// ============================================================================
// PRECALENTAMIENTO AUTOMÁTICO EN SEGUNDO PLANO
// ----------------------------------------------------------------------------
// Ejecuta en background las consultas de las pantallas principales (Dashboard,
// Mapa, Estatus y Detalle) con los filtros por defecto.
// Al abrir el portal por primera vez o tras un reinicio del servidor, los datos
// ya están calientes en RAM y se responden en <15ms.
// ============================================================================
export async function precalentarCache(): Promise<void> {
  const f = filtrosPorDefecto();
  try {
    // Fase 1: Vistas principales del Tablero
    await Promise.allSettled([
      getMetadatos(f),
      getKpis(f),
      getTendencia(f),
      getPorAseguradora(f),
      getPorGasera(f),
      getPorProducto(f),
      getPorTipoSiniestro(f),
      getHistoricos(f),
      getProyeccion(f),
    ]);
    // Fase 2: Mapa y Estatus (el detalle se consulta bajo demanda: sus filas
    // contienen datos personales y no se cachean).
    await Promise.allSettled([
      getMapa(f),
      getEstatus({ anio: ANIO_REPORTE }),
    ]);
    // Fase 3: Proyecciones por segmento (solo proyección tiene demora percibida de ~5s
    // en primer filtro). Precarga las combinaciones más comunes para que el primer
    // cambio de filtro sea instantáneo (cache hit).
    try {
      const meta = await getMetadatos(f);
      const topGaseras = meta.gaseras.slice(0, 4);
      const topAseg = meta.aseguradoras.slice(0, 3);
      const topProd = meta.productos.slice(0, 3);
      const topClases = (meta.clases ?? []).slice(0, 4);
      await Promise.allSettled([
        ...topGaseras.map((g) => getProyeccion({ gasera: [g] })),
        ...topAseg.map((a) => getProyeccion({ aseguradora: [a] })),
        ...topProd.map((p) => getProyeccion({ producto: [p] })),
        ...topClases.map((c) => getProyeccion({ clase: [c] })),
      ]);
    } catch {}
  } catch {
    // Silencioso en segundo plano
  }
}

// Iniciar precalentamiento únicamente al arrancar el servidor. Después de eso,
// la caché se revalida bajo demanda (SWR): no hay trabajo innecesario de BD con
// cero usuarios.
//
// Se registra una sola vez por proceso: en desarrollo, Vite reevalúa este módulo
// en cada recarga en caliente, y sin este candado se acumulaban un precalentado
// y un intervalo de mantenimiento por recarga (cada uno disparando consultas).
const gQuery = globalThis as typeof globalThis & { __initMantenimiento?: boolean };
if (typeof process !== 'undefined' && !gQuery.__initMantenimiento) {
  gQuery.__initMantenimiento = true;

  // Disparar precalentamiento inicial tras 100ms
  setTimeout(() => {
    precalentarCache();
  }, 100);

  // Higiene del rate-limiter (descarta buckets vencidos por IP).
  configurarLimpieza();

  // Mantenimiento periódico de la caché: barre entradas sin uso > 2 h, aplica
  // el tope de MB y registra tamaño y heap para detectar fugas de memoria.
  const mantenimiento = setInterval(() => {
    barrerCache();
    const heapMb = Math.round(process.memoryUsage().heapUsed / 1048576);
    const cacheMb = Math.round((bytesEnCache / 1048576) * 10) / 10;
    console.log(
      `[cache] ${cacheConsultas.size}/${CACHE_MAX_ENTRIES} entradas · ${cacheMb}/${Math.round(CACHE_MAX_BYTES / 1048576)} MB · heap ${heapMb} MB · ${enVuelo.size} en vuelo`,
    );
  }, CACHE_SWEEP_MS);
  if (mantenimiento.unref) mantenimiento.unref();
}