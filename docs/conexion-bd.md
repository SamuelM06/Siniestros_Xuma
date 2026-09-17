# Conexión a la Base de Datos

> Este documento describe **cómo** se conecta la aplicación, **sin incluir credenciales reales**.
> Las credenciales viven únicamente en el archivo `.env` local (gitignored).

## Motor

PostgreSQL (host corporativo, puerto 5432). La aplicación se conecta con `node-postgres` (`pg`).

## Variables de entorno (`.env`)

| Variable      | Uso                                           | Ejemplo (ficticio)  |
|---------------|-----------------------------------------------|---------------------|
| `DB_HOST`     | IP o DNS del servidor PostgreSQL              | `localhost`         |
| `DB_PORT`     | Puerto                                        | `5432`              |
| `DB_NAME`     | Nombre de la base de datos                    | `tu_base_de_datos`  |
| `DB_USER`     | Usuario de la BD (solo lectura recomendado)   | `tu_usuario`        |
| `DB_PASSWORD` | Contraseña del usuario                        | `tu_contraseña`     |
| `DB_SSL`      | `true` si el servidor exige conexión cifrada  | `false`             |
| `PORT`        | Puerto del servidor de desarrollo (Astro)     | `4321`              |

> El entorno real detectó que el servidor **exige SSL** (`pg_hba.conf` rechaza "sin cifrado"),
> por eso el pool usa `ssl: { rejectUnauthorized: false }` cuando `DB_SSL=true`.

## Capa de acceso (`src/lib/db.ts`)

```ts
import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15_000,
  max: 10,
});
```

- El pool se crea **una sola vez** y se reutiliza.
- Las consultas siempre usan **parámetros** (`$1`, `$2`) → inyección SQL mitigada.
- Errores de conexión se espejan en logs, nunca en el navegador.

## ¿Quién habla con la BD?

```
Navegador  ──HTTP──▶  Astro Endpoint (src/pages/api/*.ts)  ──SQL──▶  PostgreSQL
```

- El navegador **nunca** tiene acceso directo a la BD ni a las credenciales.
- Todo pasa por endpoints Astro que corren en el servidor.

## Buenas prácticas

- Usar un usuario con permisos de **solo lectura** para el dashboard.
- Índices recomendados: `(fecha_radicacion)`, `(estado)`, `(numero_contrato)`.
- No exponer la IP del host en documentación pública.
- Rotar la contraseña periódicamente (ya se compartió fuera del repo una vez).

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `no hay línea en pg_hba.conf ... sin cifrado` | Falta SSL | `DB_SSL=true` |
| `ECONNREFUSED` | IP/puerto no alcanzable (VPN/firewall) | Verificar red corporativa |
| `timeout` | BD lenta / muchas conexiones | Bajar `max` del pool, caché de KPIs |
| `password authentication failed` | Credenciales equivocadas | Revisar `.env`