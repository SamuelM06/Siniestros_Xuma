import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
const t = readFileSync('C:/01_Repositorio/02_Carga_Data/03_Siniestros/.env', 'utf8');
for (const l of t.split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const pool = new Pool({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
});
const r = await pool.query(`SELECT id_caso, gasera, fecha_radicacion, nombre_archivo_origen FROM siniestros.casos WHERE gasera ILIKE 'PROMIGAS%' ORDER BY id_caso`);
console.log('FILAS PROMIGAS:', r.rowCount);
for (const x of r.rows) {
  console.log(`${x.id_caso} | ${x.gasera} | ${x.fecha_radicacion instanceof Date ? x.fecha_radicacion.toISOString().slice(0, 10) : x.fecha_radicacion} | ${x.nombre_archivo_origen}`);
}
await pool.end();