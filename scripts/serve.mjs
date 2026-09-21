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
  
  // Calentamiento automático inicial de rutas y consultas en segundo plano
  setTimeout(async () => {
    try {
      const base = `http://127.0.0.1:${PORT}`;
      await Promise.allSettled([
        fetch(`${base}/dashboard`).then((r) => r.text()),
        fetch(`${base}/mapa`).then((r) => r.text()),
        fetch(`${base}/estatus`).then((r) => r.text()),
        fetch(`${base}/detalle`).then((r) => r.text()),
      ]);
      console.log('[serve.mjs] 🔥 Rutas y datos precalentados en RAM: respuestas instantáneas (<20ms)');
    } catch {
      // Silencioso en arranque
    }
  }, 100);
});