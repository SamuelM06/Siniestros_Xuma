// ============================================================================
// SERVIDOR HTTP de producción: envuelve la app Astro SSR (dist/server/entry.mjs)
// y añade compresión gzip/brotli a las respuestas (estáticos, HTML y API).
//   Uso: node scripts/serve.mjs   (PORT default 4321)
// ============================================================================
process.env.ASTRO_NODE_AUTOSTART = 'disabled';

import { createServer } from 'node:http';
import { crearProxyRespuesta } from './compresion.mjs';

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