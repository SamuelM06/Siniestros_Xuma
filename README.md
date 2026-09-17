# Siniestros Xuma — Dashboard 2026

Portal web **altamente animado y seguro** para el reporte de siniestros de **Xuma** del año 2026:
KPIs, tendencias, participación por aseguradora / gasera / producto, filtros y tabla de detalle,
todo con la identidad visual de la marca.

> ⚠️ **Seguridad:** este repositorio NO contiene credenciales ni datos sensibles. La conexión a
> PostgreSQL y los secretos de sesión se configuran con variables de entorno locales (`.env`,
> gitignored).

## Stack

- **Astro 7** (SSR con adapter `@astrojs/node`) · **React 18** (islas) · **Tailwind CSS v4** · **motion** · **Recharts 3**
- **node-postgres (`pg`)** para consultas a PostgreSQL a través de endpoints de Astro
- Tipografía corporativa **Raleway** via `@fontsource`
- Identidad visual Xuma: azul `#120180`, verdes `#5AE280` / `#00CD93`, gris `#333333`

## Requisitos

- Node.js ≥ 20
- Acceso de red al PostgreSQL corporativo (VPN según sea el caso)

## Instalación

```bash
# 1. Variables de entorno (plantilla pública → crea tu .env local)
cp .env.example .env

# 2. Dependencias
npm install

# 3. (Obligatorio) Definir usuario y contraseña del portal
npm run set-password        # escribe ADMIN_USER y ADMIN_PASSWORD_HASH en .env

# 4. Desarrollo
npm run dev                 # → http://localhost:4321

# 5. Producción
npm run build
npm run preview
```

## Acceso al portal

- Entrar en `/login` con el usuario/contraseña configurado con `npm run set-password`.
- Primera vez: usa la contraseña temporal que el administrador te entregó (el hash inicial se
  generó con una contraseña convenida por fuera del repositorio). **Debe cambiarse** antes de
  ponerlo en producción.
- Duración de la sesión: `AUTH_TTL_HOURS` (por defecto 12 h).

## Rutas

| Ruta                     | Contenido                                          |
|--------------------------|----------------------------------------------------|
| `/`                      | Sesión de bienvenida y contexto del reporte        |
| `/dashboard`             | Tablero: KPIs, gráficos, filtros y tabla           |
| `/login`                 | Inicio de sesión                                   |
| `/api/auth/login`        | POST — autentica y emite cookie `xuma_sesion`      |
| `/api/auth/logout`       | POST — cierra sesión y borra la cookie             |
| `/api/auth/me`           | GET — estado de la sesión actual                   |
| `/api/*`                 | Endpoints de datos (JSON): `kpis`, `tendencia`, `por-aseguradora`, `por-gasera`, `por-producto`, `tabla`, `metadatos` |

## Estructura

```
contexto/   → idea del proyecto y plan de desarrollo
docs/       → conexión BD, esquema, seguridad, manual de marca aplicado
public/     → logos y fuentes (marca)
scripts/    → set-password y pruebas E2E
src/
  layouts/  → MainLayout, DashboardLayout
  pages/    → index (bienvenida), login, dashboard, api/
  components/ → dashboard (orquestador), kpi, charts, filtros, tabla, ui
  lib/      → pool pg, consultas, normalización, autenticación, seguridad
  styles/   → tokens de marca (Tailwind)
  utils/    → formateadores COP/fechas y helpers
```

## Seguridad

- **Autenticación:** contraseña verificada con **scrypt** (hash con salt en `.env`, nunca texto
  plano) y token de sesión firmado con **HMAC-SHA256** (`SESSION_SECRET`).
- **Cookie de sesión** `xuma_sesion`: `HttpOnly` · `SameSite=Lax` · `Secure` (HTTPS) → no accesible
  desde JavaScript.
- **Protección global (middleware):** todas las páginas (excepto `/login` y assets) y todos los
  endpoints (excepto `/api/auth/login`) requieren sesión válida.
- **Rate limiting** por IP: login (5 intentos / 10 min) y API (180 req / min).
- **Headers de seguridad:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, CSP restrictiva.
- **Inyección SQL:** todas las consultas usan parámetros (`$1, $2, …`).
- **Datos sensibles:** la tabla de detalle excluye cédula, correo y observación.
- **Auditoría:** eventos de acceso/sesión e intentos fallidos en `logs/app.log`.

Detalle completo en `docs/seguridad.md`.

## Pruebas

```bash
npm run build
# Windows (PowerShell):
$env:E2E_PASS="tuclave"; node scripts/test-e2e.mjs
# Linux/macOS:
E2E_PASS="tuclave" node scripts/test-e2e.mjs
```

## Autor

Proyecto de análisis de datos — Xuma · 2026