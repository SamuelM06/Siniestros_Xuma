// ============================================================================
// SERVIDOR HTTP de producción: envuelve la app Astro SSR (dist/server/entry.mjs)
// y añade compresión gzip/brotli a las respuestas (estáticos, HTML y API).
//   Uso: node scripts/serve.mjs   (PORT default 4321)
// ============================================================================
process.env.ASTRO_NODE_AUTOSTART = 'disabled';

import { createServer } from 'node:http';
import { crearProxyRespuesta } from './compresion.mjs';

// Red de seguridad: una conexion cortada por el cliente (ECONNRESET, EPIPE, stream destruido) nunca debe
// tumbar el servidor. Cualquier otro error inesperado si termina el proceso para que Coolify lo reinicie.
const ERRORES_DE_CONEXION = new Set([
  'ERR_STREAM_DESTROYED', 'ERR_STREAM_WRITE_AFTER_END', 'ERR_STREAM_PREMATURE_CLOSE',
  'ECONNRESET', 'EPIPE', 'ECONNABORTED',
]);
process.on('uncaughtException', (err) => {
  if (err && ERRORES_DE_CONEXION.has(err.code)) {
    console.warn(`[serve.mjs] error de conexion ignorado: ${err.code}`);
    return;
  }
  console.error('[serve.mjs] error no controlado:', err);
  process.exit(1);
});
process.on('unhandledRejection', (motivo) => {
  console.error('[serve.mjs] promesa rechazada sin manejar:', motivo);
});

const PORT = Number(process.env.PORT || 4321);
const HOST = process.env.HOST || '0.0.0.0';

// Import dinámico: es imprescindible fijar ASTRO_NODE_AUTOSTART ANTES de
// importar la app SSR, para que Astro NO arranque su propio listener.
const { handler } = await import('../dist/server/entry.mjs');

const server = createServer((req, res) => {
  handler(req, crearProxyRespuesta(req, res));
});

server.listen(PORT, HOST, () => {
  console.log(`[serve.mjs] SSR + compresión (gzip/brotli) escuchando en http://${HOST}:${PORT}`);
});