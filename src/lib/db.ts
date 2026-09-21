import { Pool } from 'pg';
import { ENV } from './env';

// Pool único de conexiones a PostgreSQL (se crea una sola vez y se reutiliza).
const pool = new Pool({
  host: ENV.dbHost || 'localhost',
  port: ENV.dbPort,
  database: ENV.dbName || 'postgres',
  user: ENV.dbUser || 'postgres',
  password: ENV.dbPassword || '',
  ssl: ENV.dbSsl ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 300_000, // 5 minutos antes de cerrar conexiones inactivas
  max: 20, // Suficiente holgura para consultas concurrentes del SSR
  min: 2,  // Al menos 2 conexiones calientes siempre abiertas
});

// Heartbeat periódico (cada 45s) para mantener caliente el túnel SSL/TCP con Azure y evitar demoras
if (typeof setInterval !== 'undefined') {
  const hb = setInterval(() => {
    pool.query('SELECT 1').catch(() => {});
  }, 45_000);
  if (hb.unref) hb.unref();
}

export async function query<T>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(
  text: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const rows = await query<T>(text, params);
  return rows[0];
}

export { pool };