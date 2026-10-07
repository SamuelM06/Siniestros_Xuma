// ============================================================================
// Carga de los archivos VIDA DEUDOR de Efigas y Guajira desde el SharePoint.
//
// Por qué este script:
// El SharePoint syndado en `SP_DIR` trae dos carpetas nuevas que el ETL que
// corrió el 06-oct 22:57 todavia no habia visto. Ningun ETL de carga vive en
// este repo (ver context/planes/01_Actualizacion.md, seccion C0), asi que este
// script replica exactamente las convenciones que YA usa la tabla `casos`:
//
//   - id_aseguradora .... NO viene en el archivo: se atribuye cruzando cédulas
//                         contra lo ya cargado (mismo método documentado en
//                         notas_etl de Surtigas Vida Deudor y Caribe Vida Deudor).
//   - clave_natural ..... clave de idempotencia, formato por archivo.
//   - tipo_siniestro .... 'Fallecido o Incapacidad (Deudor)' (vocabulario existente).
//   - periodo_dato ...... 'Año actual' / 'Histórico' / 'Sin fecha'.
//   - vigente ........... baja lógica, nunca DELETE (igual que el ETL previo).
//   - datos_originales .. la fila cruda completa, tal cual.
//   - cargas ............ una fila por archivo+aseguradora.
//
// Uso:
//   node scripts/cargar-sharepoint.mjs                 # dry-run (default, no escribe)
//   node scripts/cargar-sharepoint.mjs --apply         # escribe (necesita usuario con INSERT)
//   node scripts/cargar-sharepoint.mjs --sql           # genera un .sql para correr en DBeaver
//   node scripts/cargar-sharepoint.mjs --solo=efigas   # solo un archivo
// ============================================================================
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';

const SP_DIR =
  process.env.SP_DIR ||
  'C:\\Users\\smena\\OneDrive - Chariot & Castle Seguros SAS\\Team Experiencia al Cliente - Promigas\\Pagos de Siniestros';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SOLO_SQL = args.includes('--sql');
const SQL_OUT = (args.find((a) => a.startsWith('--sql-out=')) || '').split('=')[1]
  || path.join('logs', 'carga-deudor.sql');
const SOLO = (args.find((a) => a.startsWith('--solo=')) || '').split('=')[1] || null;
const ANIO_REPORTE = 2026;

// ---------------------------------------------------------------------------
// Manifiesto: que hoja de que archivo, y como se mapea a `siniestros.casos`.
// Las claves de `datos_originales` NO se renombran: se guardan crudas, porque
// las reglas SQL de src/lib/normalizacion.ts las leen por nombre de columna.
// ---------------------------------------------------------------------------
const MANIFIESTO = [
  {
    archivo: '04_Efigas\\SINIESTROS VIDADEUDOR\\SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx',
    nombre_archivo_origen: 'SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx',
    hojas: ['REGISTRO DE SINIESTROS'],
    etiqueta: 'Efigas Vida Deudor',
    // Confirmado por el usuario 2026-10-07. Los cruces lo respalda: Alfa gana
    // en ambos criterios (cedula 7, nombre 7) contra Sura (5 y 4), y el
    // historico 00_Historicos/05_ALFA/DEUDOR 2022-2023 ya tiene 322 filas de
    // EFIGAS (igual que Surtigas Vida Deudor, atribuido a Alfa).
    id_aseguradora: 5,
    tipo_siniestro: 'Fallecido o Incapacidad (Deudor)',
    notas_etl:
      "Efigas Vida Deudor (hoja: REGISTRO DE SINIESTROS). Sin columna ASEGURADORA; " +
      'aseguradora atribuida por cruce de cedulas contra lo ya cargado. ' +
      "estado = RESOLUCIÓN FINAL con fallback a PRE-RESOLUCION porque la columna ESTADO " +
      'viene vacia en la mayoria de las filas. La columna PRODUCTO trae codigos numericos ' +
      'sin nombre de producto, por eso el producto se deriva de la carpeta (Deudor).',
    gasera: 'EFIGAS',
    map: {
      nombre_asegurado: 'ASEGURADO',
      nombre_afectado: 'ASEGURADO',
      numero_contrato: 'CONTRATO',
      cedula: 'IDENTIFICACIÓN',
      // estado: combinacion especial (ver filaCruda)
    },
    estado: (f) => primero(f, ['RESOLUCIÓN FINAL', 'PRE-RESOLUCION', 'ESTADO']),
    fecha_radicacion: (f) => primero(f, ['FECHA DE SOLICITUD', 'FECHA SINIESTRO']),
    observacion: (f) => primero(f, ['OBSERVACIONES']),
    // Mismo formato que su hermano 'SINIESTROS MICRO 2026 - EFIGAS.xlsx':
    // <solicitud>|<contrato>|<cedula>|<asegurado>|<reservado>
    clave_natural: (f) =>
      pipe([
        txt(f['NO. SOLICITUD REGISTRO']),
        txt(f['CONTRATO']),
        txt(f['IDENTIFICACIÓN']),
        txt(f['ASEGURADO']),
      ]),
  },
  {
    archivo: '06_Gases_Guajira\\Siniestros Deudor\\SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx',
    nombre_archivo_origen: 'SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx',
    // PAGADO = union de 2024+2025+2026 (333). Las tres anualidades NO se cargan
    // aparte o se contarian 3 veces. TRAMITE (25) va suelto.
    hojas: ['PAGADO', 'TRÁMITE'],
    etiqueta: 'Gases de La Guajira Vida Deudor',
    // Decidido por el usuario 2026-10-07: "el que salga mejor". Sura gana en
    // los dos criterios (cedula 26, nombre 19) frente a Alfa (20 y 17) y
    // HDI (13 y 10), aunque parejo: 45 cruces sobre 357 registros.
    id_aseguradora: 4,
    tipo_siniestro: 'Fallecido o Incapacidad (Deudor)',
    notas_etl:
      'Gases de La Guajira Vida Deudor (hojas: PAGADO + TRÁMITE). PAGADO ya es la union ' +
      'de las hojas 2024/2025/2026, por eso esas tres NO se cargan (evita triple conteo). ' +
      'Sin columna ASEGURADORA; aseguradora atribuida por cruce de cedulas. ' +
      'El archivo no trae columna de producto: se deriva de la carpeta (Deudor).',
    gasera: 'GASGUAJIRA',
    map: {
      nombre_asegurado: 'ASEGURADO',
      nombre_afectado: 'ASEGURADO',
      numero_contrato: 'CONTRATO',
      cedula: 'CC.',
    },
    estado: (f) => primero(f, ['ESTADO']),
    fecha_radicacion: (f) => primero(f, ['FECHA DE RECIBIDO', 'FECHA DEL SINIESTRO']),
    observacion: (f) => primero(f, ['OBSERVACION']),
    // Mismo formato que su hermano 'SINIESTROS MICROSEGUROS GASGUAJIRA.xlsx':
    // |<contrato>|<cedula>|<asegurado>|<reservado>
    clave_natural: (f) => pipe(['', txt(f['CONTRATO']), txt(f['CC.']), txt(f['ASEGURADO'])]),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Las cabeceras del SharePoint traen espacios finales y saltos de linea
// ('CC. ', 'FECHA DE RECIBIDO ', 'FECHA ENVÍO\nASEGURADORA', 'VALIDACIÓN PAGO ').
const normKey = (k) => String(k ?? '').replace(/\s+/g, ' ').trim();

function leerHoja(ruta, nombreHoja) {
  const buf = fs.readFileSync(ruta);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], {
    defval: null,
    raw: true,
  });
  return filas.map((fila) => {
    const out = {};
    for (const k of Object.keys(fila)) out[normKey(k)] = fila[k];
    return out;
  });
}

function txt(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).replace(/\s+/g, ' ').trim();
}

// Las cedulas vienen con separador de miles ('40,913,523').
function soloDigitos(v) {
  return txt(v).replace(/\D/g, '');
}

function pipe(parts) {
  return parts.map((p) => p.replace(/\|/g, ' ')).join('|');
}

function primero(fila, claves) {
  for (const k of claves) {
    const v = fila[k];
    if (v !== null && v !== undefined && txt(v) !== '') return v;
  }
  return null;
}

function aFecha(v) {
  if (!v) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) || v.getUTCFullYear() < 1900 || v.getUTCFullYear() > 2100
      ? null
      : v.toISOString().slice(0, 10);
  }
  const s = txt(v);
  // 2026-01-02 / 2026-01-02T00:00:00
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // 1/2/26  (d/m/yy) o 1/2/2026
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mes = m[2].padStart(2, '0');
    let a = m[3];
    if (a.length === 2) a = Number(a) > 30 ? `20${a}` : `20${a}`;
    return `${a}-${mes}-${d}`;
  }
  // 1-Jun-23
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const meses = {
      ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
      jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12',
    };
    const mes = meses[m[2].toLowerCase()];
    if (!mes) return null;
    let a = m[3];
    if (a.length === 2) a = `20${a}`;
    return `${a}-${mes}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

function periodo(fechaIso) {
  if (!fechaIso) return 'Sin fecha';
  return Number(fechaIso.slice(0, 4)) >= ANIO_REPORTE ? 'Año actual' : 'Histórico';
}

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  application_name: 'carga_sharepoint_deudor',
  max: 4,
});

const ASEGURADORAS = {
  hdi: 1, cardiff: 2, proexequial: 3, sura: 4, alfa: 5,
};

const NOMBRES_ASEGURADORA = {
  1: 'hdseguros', 2: 'cardifbnpparibas', 3: 'proexequial', 4: 'segurossura', 5: 'segurosalfa',
};

// Atribuye la aseguradora cruzando las filas nuevas contra lo ya cargado.
// Mismo metodo que documento el ETL previo en notas_etl ("cruce de 1.975
// nombres contra ALFA-Surtigas"): se cruza por CEDULA y por NOMBRE.
async function atribuirAseguradora(registros, nombreArchivo, gasera) {
  const payload = JSON.stringify(
    registros.map((r, i) => ({
      i,
      cedula: String(r.cedula ?? '').replace(/\D/g, ''),
      nombre: String(r.nombre_afectado ?? r.nombre_asegurado ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase(),
    })),
  );

  const base = `
    FROM jsonb_array_elements($1::jsonb) AS x
    JOIN siniestros.casos c
      ON c.vigente
     AND c.nombre_archivo_origen NOT ILIKE '%planilla%'
     AND c.nombre_archivo_origen <> $2
     AND upper(btrim(COALESCE(c.gasera,''))) LIKE '%' || $3 || '%'
    WHERE `;

  const porCedula = await pool.query(
    `SELECT c.id_aseguradora, count(DISTINCT (x->>'i'))::int AS coincidencias ${base}
       regexp_replace(COALESCE(c.cedula,''), '\\D', '', 'g') = regexp_replace((x->>'cedula'), '\\D', '', 'g')
       AND regexp_replace((x->>'cedula'), '\\D', '', 'g') <> ''
     GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
    [payload, nombreArchivo, gasera.replace(/^GAS/i, '')],
  );
  const porNombre = await pool.query(
    `SELECT c.id_aseguradora, count(DISTINCT (x->>'i'))::int AS coincidencias ${base}
       upper(btrim(COALESCE(c.nombre_afectado, c.nombre_asegurado, ''))) = (x->>'nombre')
       AND (x->>'nombre') <> ''
     GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
    [payload, nombreArchivo, gasera.replace(/^GAS/i, '')],
  );

  return { porCedula: porCedula.rows, porNombre: porNombre.rows };
}

// Registro literal a jsonb, con fechas en ISO (igual que el ETL previo).
function datosOriginales(fila) {
  const out = {};
  for (const [k, v] of Object.entries(fila)) {
    if (v === null || v === undefined) out[k] = null;
    else if (v instanceof Date) out[k] = v.toISOString();
    else out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Carga de un archivo
// ---------------------------------------------------------------------------
async function procesar(def) {
  const ruta = path.join(SP_DIR, def.archivo);
  const reporte = { etiqueta: def.etiqueta, archivo: def.archivo };

  if (!fs.existsSync(ruta)) {
    return { ...reporte, error: `no existe: ${ruta}` };
  }

  // --- lectura -------------------------------------------------------------
  let brutas = 0;
  let filas = [];
  for (const hoja of def.hojas) {
    const r = leerHoja(ruta, hoja);
    brutas += r.length;
    filas.push(...r.map((f) => ({ ...f, __hoja: hoja })));
  }
  reporte.filas_excel = brutas;

  // --- dedupe dentro del archivo por clave_natural -------------------------
  const vistas = new Map();
  let sinClave = 0;
  for (const f of filas) {
    const clave = def.clave_natural(f);
    const contrato = txt(f[def.map.numero_contrato]);
    const cedula = soloDigitos(f[def.map.cedula]);
    const nombre = txt(f[def.map.nombre_asegurado]);
    if (!contrato && !cedula) {
      sinClave++;
      continue;
    }
    const anterior = vistas.get(clave);
    const fecha = aFecha(def.fecha_radicacion(f));
    // Si la misma clave aparece en varias hojas, gana la que tenga fecha.
    if (!anterior || (!aFecha(def.fecha_radicacion(anterior)) && fecha)) vistas.set(clave, f);
  }
  reporte.filas_deduplicadas = filas.length - sinClave - vistas.size;
  reporte.filas_a_cargar = vistas.size;
  reporte.filas_sin_contrato_ni_cedula = sinClave;

  // --- normalizacion -------------------------------------------------------
  const registros = [];
  for (const f of vistas.values()) {
    const fecha = aFecha(def.fecha_radicacion(f));
    registros.push({
      clave_natural: def.clave_natural(f),
      nombre_asegurado: txt(f[def.map.nombre_asegurado]) || null,
      nombre_reclamante: null,
      nombre_afectado: txt(f[def.map.nombre_afectado]) || null,
      numero_contrato: txt(f[def.map.numero_contrato]) || null,
      cedula: soloDigitos(f[def.map.cedula]) || null,
      estado: (() => {
        const v = def.estado(f);
        const s = txt(v);
        return s === '' ? null : s.toUpperCase();
      })(),
      fecha_radicacion: fecha,
      observacion: (() => {
        const s = txt(def.observacion(f));
        return s === '' ? null : s;
      })(),
      tipo_siniestro: def.tipo_siniestro,
      proveedor: null,
      gasera: def.gasera,
      datos_originales: datosOriginales(f),
      nombre_archivo_origen: def.nombre_archivo_origen,
      notas_etl: def.notas_etl,
      periodo_dato: periodo(fecha),
    });
  }

  // --- atribucion de aseguradora ------------------------------------------
  const atrib = await atribuirAseguradora(registros, def.nombre_archivo_origen, def.gasera);
  reporte.cruces = { por_cedula: atrib.porCedula, por_nombre: atrib.porNombre };
  const totales = new Map();
  for (const lista of [atrib.porCedula, atrib.porNombre]) {
    for (const c of lista) totales.set(c.id_aseguradora, (totales.get(c.id_aseguradora) ?? 0) + c.coincidencias);
  }
  reporte.cruces_combinado = [...totales.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ id, n }));

  // La aseguradora viene fijada en el manifiesto (confirmada por el usuario);
  // los cruces quedan como evidencia, no como decision automatica.
  if (!def.id_aseguradora) return { ...reporte, error: 'manifiesto sin id_aseguradora' };
  reporte.aseguradora_id = def.id_aseguradora;
  reporte.cruces_del_archivo = totales.get(def.id_aseguradora) ?? 0;
  reporte.cobertura_por_cruces = registros.length
    ? Math.round((((totales.get(def.id_aseguradora) ?? 0) / registros.length) * 1000) / 10)
    : 0;
  for (const r of registros) r.id_aseguradora = def.id_aseguradora;

  // --- comparacion con lo ya cargado --------------------------------------
  const { rows: actuales } = await pool.query(
    `SELECT clave_natural, nombre_asegurado, numero_contrato, cedula, estado,
            fecha_radicacion, tipo_siniestro, gasera, periodo_dato, vigente
     FROM siniestros.casos
     WHERE nombre_archivo_origen = $1`,
    [def.nombre_archivo_origen],
  );
  const mapaActual = new Map(actuales.map((r) => [r.clave_natural, r]));

  let nuevas = 0;
  let sinCambio = 0;
  let actualizadas = 0;
  const aInsertar = [];
  const aActualizar = [];
  for (const r of registros) {
    const prev = mapaActual.get(r.clave_natural);
    if (!prev) {
      nuevas++;
      aInsertar.push(r);
      continue;
    }
    const igual =
      (prev.nombre_asegurado ?? '') === (r.nombre_asegurado ?? '') &&
      (prev.numero_contrato ?? '') === (r.numero_contrato ?? '') &&
      (prev.cedula ?? '') === (r.cedula ?? '') &&
      (prev.estado ?? '') === (r.estado ?? '') &&
      String(prev.fecha_radicacion ?? '').slice(0, 10) === (r.fecha_radicacion ?? '') &&
      (prev.tipo_siniestro ?? '') === (r.tipo_siniestro ?? '');
    if (igual) sinCambio++;
    else {
      actualizadas++;
      aActualizar.push({ ...r, id_caso: prev.id_caso });
    }
  }
  reporte.existentes_en_bd = actuales.length;
  reporte.vigentes_en_bd = actuales.filter((r) => r.vigente).length;
  reporte.nuevas = nuevas;
  reporte.sin_cambio = sinCambio;
  reporte.actualizadas = actualizadas;

  // --- escritura ----------------------------------------------------------
  if (APPLY) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Actualizaciones: se edita la fila viva (no hay baja logica: el
      // registro sigue siendo el mismo caso con datos corregidos).
      for (const r of aActualizar) {
        await client.query(
          `UPDATE siniestros.casos SET
             nombre_asegurado=$2, nombre_reclamante=$3, nombre_afectado=$4,
             numero_contrato=$5, cedula=$6, estado=$7, fecha_radicacion=$8,
             observacion=$9, tipo_siniestro=$10, proveedor=$11, gasera=$12,
             datos_originales=$13, notas_etl=$14, periodo_dato=$15,
             clave_natural=$16, id_aseguradora=$17, vigente=true, fecha_carga=now()
           WHERE id_caso=$1`,
          [r.id_caso, r.nombre_asegurado, r.nombre_reclamante, r.nombre_afectado,
           r.numero_contrato, r.cedula, r.estado, r.fecha_radicacion, r.observacion,
           r.tipo_siniestro, r.proveedor, r.gasera, JSON.stringify(r.datos_originales),
           r.notas_etl, r.periodo_dato, r.clave_natural, r.id_aseguradora],
        );
      }

      // Altas.
      for (const r of aInsertar) {
        await client.query(
          `INSERT INTO siniestros.casos
             (id_aseguradora, nombre_asegurado, nombre_reclamante, nombre_afectado,
              numero_contrato, cedula, estado, fecha_radicacion, observacion,
              tipo_siniestro, proveedor, gasera, datos_originales,
              nombre_archivo_origen, notas_etl, clave_natural, periodo_dato)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [r.id_aseguradora, r.nombre_asegurado, r.nombre_reclamante, r.nombre_afectado,
           r.numero_contrato, r.cedula, r.estado, r.fecha_radicacion, r.observacion,
           r.tipo_siniestro, r.proveedor, r.gasera, JSON.stringify(r.datos_originales),
           r.nombre_archivo_origen, r.notas_etl, r.clave_natural, r.periodo_dato],
        );
      }

      // Bajas logicas: claves que ya no estan en el Excel. Se mueven a
      // casos_historial y se marcan vigente=false (nunca DELETE).
      const clavesNuevas = new Set(registros.map((r) => r.clave_natural));
      const bajas = actuales.filter((r) => r.vigente && !clavesNuevas.has(r.clave_natural));
      for (const b of bajas) {
        await client.query(
          `INSERT INTO siniestros.casos_historial
             (id_caso, fecha_cambio, tipo_cambio, gasera, nombre_asegurado,
              nombre_reclamante, nombre_afectado, numero_contrato, cedula, estado,
              fecha_radicacion, observacion, tipo_siniestro, datos_originales,
              nombre_archivo_origen)
           SELECT id_caso, now(), 'baja_por_recarga', gasera, nombre_asegurado,
                  nombre_reclamante, nombre_afectado, numero_contrato, cedula, estado,
                  fecha_radicacion, observacion, tipo_siniestro, datos_originales,
                  nombre_archivo_origen
           FROM siniestros.casos WHERE id_caso = $1`,
          [b.id_caso],
        );
        await client.query(
          `UPDATE siniestros.casos
             SET vigente = false, fecha_carga = now()
           WHERE id_caso = $1`,
          [b.id_caso],
        );
      }
      reporte.bajas_logicas = bajas.length;

      // Bitacora: una fila por archivo+aseguradora.
      const nombreAseg = (await client.query(
        `SELECT nombre FROM siniestros.aseguradoras WHERE id_aseguradora=$1`,
        [def.id_aseguradora],
      )).rows[0].nombre;
      await client.query(
        `INSERT INTO siniestros.cargas
           (aseguradora, nombre_archivo, fecha_carga, filas_leidas,
            filas_cargadas, estado, notas)
         VALUES ($1,$2,now(),$3,$4,$5,$6)`,
        [nombreAseg.toLowerCase().replace(/\s+/g, ''), def.nombre_archivo_origen, brutas,
         nuevas + actualizadas, 'OK', `cargar-sharepoint: ${APPLY ? 'aplicado' : 'dry-run'}; dedupe=${reporte.filas_deduplicadas}`],
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // --- muestra de como se veria en el dashboard ---------------------------
  const estados = {};
  const periodos = {};
  let conMonto = 0;
  for (const r of registros) {
    estados[r.estado ?? 'null'] = (estados[r.estado ?? 'null'] ?? 0) + 1;
    periodos[r.periodo_dato] = (periodos[r.periodo_dato] ?? 0) + 1;
    const d = r.datos_originales ?? {};
    if (soloDigitos(d['VALIDACIÓN PAGO'] ?? d['MONTO'] ?? d['MONTO CANCELADO']) !== '') conMonto++;
  }
  reporte.distribucion_estado = estados;
  reporte.distribucion_periodo = periodos;
  reporte.con_monto = conMonto;
  reporte.registros = registros;
  reporte.a_insertar = aInsertar;
  return reporte;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Generacion de SQL para correr con un usuario con permisos de escritura.
// Idempotente: cada INSERT se saltea si la clave natural ya existe vigente, asi
// que se puede correr mas de una vez sin duplicar.
// ---------------------------------------------------------------------------
function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function litJson(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${JSON.stringify(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'::jsonb`;
}

const COLS = [
  'id_aseguradora', 'nombre_asegurado', 'nombre_reclamante', 'nombre_afectado',
  'numero_contrato', 'cedula', 'estado', 'fecha_radicacion', 'observacion',
  'tipo_siniestro', 'proveedor', 'gasera', 'datos_originales',
  'nombre_archivo_origen', 'notas_etl', 'clave_natural', 'periodo_dato',
];

function filaSql(r) {
  return `    (${r.id_aseguradora}, ${lit(r.nombre_asegurado)}, ${lit(r.nombre_reclamante)}, ` +
    `${lit(r.nombre_afectado)}, ${lit(r.numero_contrato)}, ${lit(r.cedula)}, ` +
    `${lit(r.estado)}, ${r.fecha_radicacion ? lit(r.fecha_radicacion) + '::date' : 'NULL'}, ` +
    `${lit(r.observacion)}, ${lit(r.tipo_siniestro)}, ${lit(r.proveedor)}, ${lit(r.gasera)}, ` +
    `${litJson(r.datos_originales)}, ${lit(r.nombre_archivo_origen)}, ${lit(r.notas_etl)}, ` +
    `${lit(r.clave_natural)}, ${lit(r.periodo_dato)})`;
}

function bloqueSql(def, registros, nombreAsegSlug) {
  const out = [];
  out.push(`\n-- =====================================================================`);
  out.push(`-- ${def.etiqueta}`);
  out.push(`-- origen: ${def.archivo}`);
  out.push(`-- hojas : ${def.hojas.join(' + ')}`);
  out.push(`-- registros a insertar: ${registros.length}`);
  out.push(`-- aseguradora: id ${def.id_aseguradora} (${nombreAsegSlug})`);
  out.push(`-- =====================================================================`);

  // 1. Bajas logicas de claves que ya no esten en el Excel (idempotencia).
  out.push(`
-- Baja logica de registros de este archivo que ya no existan en el Excel.
-- No borra: copia a casos_historial y marca vigente=false (convención del ETL).
INSERT INTO siniestros.casos_historial
  (id_caso, fecha_cambio, tipo_cambio, gasera, nombre_asegurado,
   nombre_reclamante, nombre_afectado, numero_contrato, cedula, estado,
   fecha_radicacion, observacion, tipo_siniestro, datos_originales, nombre_archivo_origen)
SELECT id_caso, now(), 'baja_por_recarga', gasera, nombre_asegurado,
       nombre_reclamante, nombre_afectado, numero_contrato, cedula, estado,
       fecha_radicacion, observacion, tipo_siniestro, datos_originales,
       nombre_archivo_origen
FROM siniestros.casos
WHERE vigente
  AND nombre_archivo_origen = ${lit(def.nombre_archivo_origen)}
  AND NOT (clave_natural = ANY (
    SELECT unnest(ARRAY[${registros.map((r) => lit(r.clave_natural)).join(', ')}])
  ));

UPDATE siniestros.casos SET vigente = false, fecha_carga = now()
WHERE vigente
  AND nombre_archivo_origen = ${lit(def.nombre_archivo_origen)}
  AND NOT (clave_natural = ANY (
    SELECT unnest(ARRAY[${registros.map((r) => lit(r.clave_natural)).join(', ')}])
  ));
`);

  // 2. Altas, en bloques de 100, saltando lo que ya exista vigente.
  const LOTE = 100;
  for (let i = 0; i < registros.length; i += LOTE) {
const lote = registros.slice(i, i + LOTE);
    out.push(`
-- altas ${i + 1}-${i + lote.length} de ${registros.length}
INSERT INTO siniestros.casos (${COLS.join(', ')})
SELECT v.*
FROM (VALUES
${lote.map(filaSql).join(',\n')}
) AS v(${COLS.join(', ')})
WHERE NOT EXISTS (
  SELECT 1 FROM siniestros.casos c
  WHERE c.nombre_archivo_origen = ${lit(def.nombre_archivo_origen)}
    AND c.clave_natural = v.clave_natural
    AND c.vigente
);`);
  }

  // 3. Bitacora.
  out.push(`
INSERT INTO siniestros.cargas
  (aseguradora, nombre_archivo, fecha_carga, filas_leidas, filas_cargadas, estado, notas)
VALUES (${lit(nombreAsegSlug)}, ${lit(def.nombre_archivo_origen)}, now(), NULL, NULL, 'OK',
        ${lit(`cargar-sharepoint --sql; ${def.etiqueta}; hojas=${def.hojas.join('+')}; insurance_id=${def.id_aseguradora}`)})
ON CONFLICT DO NOTHING;
`);
  return out.join('\n');
}

function encabezadoSql() {
  return `-- ============================================================================
-- Carga de los archivos VIDA DEUDOR de Efigas y Guajira
-- Generado por scripts/cargar-sharepoint.mjs --sql  (${new Date().toISOString()})
--
-- CONVENCIONES (las mismas del ETL que corrio el 2026-10-06 22:57):
--   - Nunca DELETE: las bajas son logicas (vigente=false + casos_historial).
--   - Idempotente: los INSERT se saltan si la clave natural ya existe vigente.
--   - datos_originales guarda la fila cruda del Excel; las reglas SQL de
--     src/lib/normalizacion.ts la leen por nombre de columna.
--
-- COMO CORRERLO: abrir en DBeaver con un usuario que tenga INSERT/UPDATE en
-- el esquema siniestros (el usuario de la app, samuel_mena, es solo lectura).
--
-- client_encoding va forzado a UTF8: los nombres tienen tildes (LONDOÑO,
-- IDENTIFICACIÓN, VALIDACIÓN PAGO) y si DBeaver abre el archivo en LATIN1
-- quedan corruptos al insertar.
-- ============================================================================
SET client_encoding = 'UTF8';
BEGIN;
`;
}

function pieSql() {
  return `
COMMIT;

-- ============================================================================
-- VERIFICACION (leer el resultado antes de presentar)
-- ============================================================================
SELECT 'vivos' AS check, count(*) AS filas
FROM siniestros.casos WHERE vigente
UNION ALL SELECT 'fantasma (no debe contar)', count(*) FROM siniestros.casos WHERE NOT vigente;

-- 1) Los dos archivos nuevos deben aparecer con sus conteos
SELECT nombre_archivo_origen,
       count(*) FILTER (WHERE vigente) AS vigentes,
       count(*) AS total,
       count(DISTINCT clave_natural) AS claves_distintas
FROM siniestros.casos
WHERE nombre_archivo_origen ILIKE '%VIDADEUDOR%'
   OR nombre_archivo_origen ILIKE '%VIDA DEUDOR GASGUAJIRA%'
GROUP BY 1;

-- 2) ESTA DEBE SALIR VACIA: si trae filas, hay claves duplicadas
SELECT nombre_archivo_origen, clave_natural, count(*) AS veces
FROM siniestros.casos
WHERE vigente AND clave_natural IS NOT NULL
GROUP BY 1,2 HAVING count(*) > 1 ORDER BY veces DESC LIMIT 20;

-- 3) Deudor por gasera (lo que pediste presentar)
SELECT gasera, estado, count(*) AS n
FROM siniestros.casos
WHERE vigente AND nombre_archivo_origen ILIKE '%DEUDOR%'
GROUP BY 1,2 ORDER BY 1,3 DESC;
`;
}

async function main() {
  console.log(`SP_DIR : ${SP_DIR}`);
  console.log(
    `modo   : ${APPLY ? 'APPLY (escribe en la BD)' : SOLO_SQL ? 'SQL (genera archivo .sql)' : 'DRY-RUN (no escribe)'}`,
  );
  console.log('');

  const candidatos = SOLO
    ? MANIFIESTO.filter((d) => d.nombre_archivo_origen.toLowerCase().includes(SOLO.toLowerCase()))
    : MANIFIESTO;

  const reportes = [];
  for (const def of candidatos) {
    process.stdout.write(`-> ${def.etiqueta} ... `);
    const r = await procesar(def);
    reportes.push(r);
    console.log(r.error ? `ERROR: ${r.error}` : 'ok');
  }

  console.log('\n================ REPORTE ================');
  for (const r of reportes) {
    console.log(`\n### ${r.etiqueta}`);
    console.log(`    archivo : ${r.archivo}`);
    if (r.error) {
      console.log(`    ERROR   : ${r.error}`);
      continue;
    }
    console.log(`    filas en Excel           : ${r.filas_excel}`);
    console.log(`    deduplicadas en archivo  : ${r.filas_deduplicadas}`);
    console.log(`    sin contrato ni cedula   : ${r.filas_sin_contrato_ni_cedula}`);
    console.log(`    a cargar (registros)     : ${r.filas_a_cargar}`);
    console.log(`    ya en BD (todas)         : ${r.existentes_en_bd}`);
    console.log(`    ya en BD (vigentes)      : ${r.vigentes_en_bd}`);
    console.log(`    nuevas                   : ${r.nuevas}`);
    console.log(`    actualizadas             : ${r.actualizadas}`);
    console.log(`    sin cambio               : ${r.sin_cambio}`);
    if (APPLY) console.log(`    bajas logicas            : ${r.bajas_logicas ?? 0}`);
    console.log(
      `    aseguradora             : id=${r.aseguradora_id} cruzados=${r.cruces_del_archivo}/${r.filas_a_cargar} (${r.cobertura_por_cruces}%)`,
    );
    console.log(`      por cedula            : ${JSON.stringify(r.cruces?.por_cedula ?? [])}`);
    console.log(`      por nombre            : ${JSON.stringify(r.cruces?.por_nombre ?? [])}`);
    console.log(`    con monto                : ${r.con_monto}/${r.filas_a_cargar}`);
    console.log(`    periodo_dato             : ${JSON.stringify(r.distribucion_periodo)}`);
    console.log(`    estados                  : ${JSON.stringify(r.distribucion_estado)}`);
  }

  const errs = reportes.filter((r) => r.error);

  if (SOLO_SQL) {
    const bloques = [];
    let total = 0;
    for (let i = 0; i < reportes.length; i++) {
      const r = reportes[i];
      if (r.error || !r.a_insertar?.length) continue;
      const def = candidatos[i];
      const slug = NOMBRES_ASEGURADORA[def.id_aseguradora];
      bloques.push(bloqueSql(def, r.registros, slug));
      total += r.a_insertar.length;
    }
    const destino = path.isAbsolute(SQL_OUT) ? SQL_OUT : path.join(process.cwd(), SQL_OUT);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, encabezadoSql() + bloques.join('\n') + pieSql(), 'utf8');
    console.log(`\nSQL generado: ${destino}  (${total} altas)`);
    console.log('Correrlo en DBeaver con un usuario con INSERT/UPDATE en el esquema siniestros.');
    console.log('El usuario de la app (samuel_mena) es solo lectura: no alcanza.');
  }

  console.log(
    `\n${APPLY ? 'ESCRITO' : SOLO_SQL ? 'SQL GENERADO' : 'SIMULADO'}: ${reportes.length - errs.length} ok, ${errs.length} con error`,
  );
  if (!APPLY && !SOLO_SQL) console.log('Nada se escribió en la BD. Usa --apply o --sql.');
  await pool.end();
}

main().catch(async (e) => {
  console.error('FALLO:', e.message);
  await pool.end();
  process.exit(1);
});