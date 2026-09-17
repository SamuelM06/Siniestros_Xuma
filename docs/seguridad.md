# Seguridad — Portal Siniestros Xuma

Descripción de las capas de seguridad implementadas y cómo verificarlas.

## 1. Configuración (variables de entorno)

Todo lo sensible vive en `.env` (gitignored). `.env.example` contiene solo valores ficticios.

| Variable                  | Uso                                                         |
|---------------------------|-------------------------------------------------------------|
| `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` | Conexión PostgreSQL corporativa |
| `DB_SSL`                  | `true` exige conexión cifrada (cifrado está habilitado con cert auto-firmado → `rejectUnauthorized: false`) |
| `ADMIN_USER`              | Usuario del portal                                          |
| `ADMIN_PASSWORD_HASH`     | `salt_hex:hash_hex` generado con scrypt (`npm run set-password`) |
| `SESSION_SECRET`          | Clave aleatoria para firmar tokens de sesión (HMAC-SHA256)   |
| `AUTH_TTL_HOURS`          | Vigencia de la sesión (por defecto 12 h)                     |
| `RATE_LIMIT_*`            | Límites de rate limiting                                    |

La contraseña en texto plano **nunca** se guarda en archivos.

## 2. Autenticación (`src/lib/auth.ts`)

- Verificación de credenciales con **scrypt** (`X`, N=16384) y comparación en tiempo constante.
- Token de sesión: `base64url(payload).base64url(hmac_sha256(payload))`.
  El payload incluye usuario y expiración; la firma impide forjar/modificar tokens.
- Cookie `xuma_sesion`: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` si el sitio es HTTPS,
  `Max-Age` según `AUTH_TTL_HOURS`.

## 3. Protección global (`src/middleware.ts`)

- **Páginas:** cualquier ruta sin sesión → redirección `302` a `/login`.
- **API:** cualquier `/api/*` sin sesión → `401` (excepto `POST /api/auth/login`).
- **CSRF:** Astro con `security.checkOrigin: true` rechaza solicitudes con `Origin`/`Sec-Fetch-Site`
  ajenos al host.
- **Headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, CSP (`default-src 'self'`, scripts/estilos same-origin, conexiones
  a `https:*`, imágenes/data, fuentes same-origin, órbita con `animation` y estilos inline permitidos
  por Recharts/motion). La configuración CSP se ajusta en `src/middleware.ts` si algún recurso nuevo
  lo requiere.

## 4. Rate limiting (`src/lib/ratelimit.ts`)

- Login: 5 intentos por IP / 10 min → `429`.
- API: 180 solicitudes por IP / min → `429`.
- Tabla Hash en memoria con limpieza periódica.

## 5. Datos (inyección y fuga)

- Todas las consultas usan parámetros posicionales `$1..$n` (nunca interpolación de input).
- Fechas validadas con regex `^\d{4}-\d{2}-\d{2}$`; textos recortados con límite de longitud.
- La tabla de detalle **no expone** cédula, correo ni observación (Solo `numero_contrato`,
  `nombre_asegurado`, aseguradora, gasera, producto, estado, fecha y monto).
- Los valores JSONB de montos se extraen según aseguradora (ver `src/lib/normalizacion.ts`).

## 6. Auditoría (`src/lib/log.ts` → `logs/app.log`)

Eventos registrados: accesos sin sesión, logins exitosos/fallidos, cambios de contraseña,
errores de servidor. La carpeta `logs/` está en `.gitignore`.

## 7. Límites conocidos y recomendaciones

- La sesión es stateless: la cookie eliminada impide su uso en el navegador, pero un token
  comprometido conserva validez hasta su expiración (`AUTH_TTL_HOURS`). Para revocación inmediata
  se requeriría un store de sesiones en el servidor.
- Por protocolo, se recomienda:
  - Cambiar la contraseña inicial del portal con `npm run set-password`.
  - Regenerar `SESSION_SECRET` (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
  - Poner HTTPS en producción y rotar las credenciales de BD del usuario de lectura.

## 8. Verificación automatizada

```bash
npm run build
node scripts/test-e2e.mjs
```

El script comprueba: redirección de páginas sin sesión, `401` de la API sin sesión, rechazo de
login inválido, login correcto + atributos de cookie, datos reales de todos los endpoints, tabla
sin campos sensibles, render del dashboard, headers de seguridad y rechazo de token manipulado.