// Capa de lectura de variables de entorno.
// Se protege: nada de esto llega al navegador (solo módulos del servidor importan esto).

type EnvBag = Record<string, string | undefined>;

function bag(): EnvBag {
  const meta = (import.meta as unknown as { env?: EnvBag }).env ?? {};
  return { ...meta, ...process.env };
}

function env(key: string, fallback = ''): string {
  const v = bag()[key];
  return v === undefined || v === '' ? fallback : v;
}

function num(key: string, fallback: number): number {
  const v = Number(env(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const ENV = {
  dbHost: env('DB_HOST'),
  dbPort: num('DB_PORT', 5432),
  dbName: env('DB_NAME'),
  dbUser: env('DB_USER'),
  dbPassword: env('DB_PASSWORD'),
  dbSsl: env('DB_SSL') === 'true',

  adminUser: env('ADMIN_USER', 'analista'),
  adminPasswordHash: env('ADMIN_PASSWORD_HASH'),
  sessionSecret: env('SESSION_SECRET'),
  authTtlHours: num('AUTH_TTL_HOURS', 12),

  rateLoginMax: num('RATE_LIMIT_LOGIN_MAX', 5),
  rateLoginWindowMs: num('RATE_LIMIT_LOGIN_WINDOW_MS', 600_000),
  rateApiMax: num('RATE_LIMIT_API_MAX', 180),
  rateApiWindowMs: num('RATE_LIMIT_API_WINDOW_MS', 60_000),

  isHttps: env('APP_HTTPS') === 'true' || !/localhost/i.test(env('APP_BASE_URL', 'http://localhost')),
} as const;