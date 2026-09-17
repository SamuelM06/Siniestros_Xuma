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
  idleTimeoutMillis: 30_000,
  max: ENV.dbSsl ? 5 : 10,
});

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