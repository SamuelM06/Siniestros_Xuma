// ============================================================================
// Abstracción de respuesta que comprime (gzip/brotli) cuando:
//   - el cliente lo acepta (Accept-Encoding) y
//   - el Content-Type es compresible.
// Intercepta res.write/res.end/res.writeHead/res.setHeader/res.removeHeader
// con un Proxy, de modo que cualquier intento de escribir (SSR de Astro y el
// pipe de estáticos de `send`) pase SIEMPRE por el stream de compresión.
// ============================================================================
import { constants as zc, createBrotliCompress, createGzip } from 'node:zlib';
import { Writable } from 'node:stream';

const NO_COMPRIMIR = [
  'application/octet-stream',
  'application/pdf',
  'application/zip',
  'image/',
  'font/',
  'audio/',
  'video/',
];

function esCompresible(contentType) {
  if (!contentType) return true;
  const tipo = String(contentType).split(';')[0].trim().toLowerCase();
  if (NO_COMPRIMIR.some((p) => tipo.startsWith(p))) return false;
  return (
    tipo.startsWith('text/') ||
    /^application\/(?:[a-z0-9._,+-]*\+)?json$/.test(tipo) ||
    /^application\/(javascript|x-javascript|xml|xhtml)/.test(tipo) ||
    tipo === 'image/svg+xml'
  );
}

// Cabecera de caché según el tipo de recurso estático:
//   - /vendor/ y /_astro/: archivos con hash de contenido => inmutables (el
//     navegador no vuelve a pedirlos hasta que cambie el hash del build).
//   - /data/ y /logos/: nombres fijos (GEOJSON de Colombia, logos), pueden
//     cambiar sin cambiar de nombre => corto (1 día + SWR).
function cabeceraCache(url) {
  if (/^\/(vendor|_astro)\//i.test(url)) {
    return 'public, max-age=31536000, immutable';
  }
  if (/^\/(data|logos)\//i.test(url)) {
    return 'public, max-age=86400, stale-while-revalidate=604800';
  }
  return null;
}

function crearProxyRespuesta(req, res) {
  // Referencias al ServerResponse original ANTES de cualquier override.
  const raw = {
    writeHead: res.writeHead.bind(res),
    setHeader: res.setHeader.bind(res),
    removeHeader: res.removeHeader.bind(res),
    write: res.write.bind(res),
    end: res.end.bind(res),
  };

  let tipoContenido = '';
  let zlibStream = null;
  let comprimiendo = false;
  let onwritePendientes = [];

  function iniciarCompresion() {
    if (res.statusCode === 204 || res.statusCode === 304) return false;
    if (!esCompresible(tipoContenido)) return false;

    const accept = String(req.headers['accept-encoding'] ?? '');
    const usaBrotli = /\bbr\b/i.test(accept);
    const usaGzip = /\bgzip\b/i.test(accept);
    if (!usaBrotli && !usaGzip) return false;

    // Brotli a su calidad por defecto (11) tarda ~20 s en comprimir el GeoJSON de municipios (2,3 MB) y satura los
    // hilos del servidor: durante ese tiempo el resto de peticiones se queda esperando y Nginx responde 502.
    // Calidad 4 comprime casi igual de bien y en una fraccion del tiempo; gzip a nivel 6 es el estandar.
    zlibStream = usaBrotli
      ? createBrotliCompress({ params: { [zc.BROTLI_PARAM_QUALITY]: 4 } })
      : createGzip({ level: 6 });

    raw.removeHeader('content-length');
    raw.setHeader('content-encoding', usaBrotli ? 'br' : 'gzip');
    raw.setHeader('vary', 'accept-encoding');

    // Si el cliente (o Cloudflare) corta la conexion a mitad de respuesta, `res` queda destruido
    // mientras zlib sigue produciendo datos. Escribir ahi lanza ERR_STREAM_DESTROYED; sin atender
    // ese caso el error quedaba sin capturar y tumbaba el proceso (502 hasta que Coolify lo levantara).
    // Ahora se descarta en silencio lo que ya no tiene a quien enviarse.
    const clienteSeFue = () => res.destroyed || res.writableEnded;

    const salida = new Writable({
      write(chunk, _enc, cb) {
        if (clienteSeFue()) return cb();
        try {
          raw.write(chunk, cb);
        } catch {
          cb();
        }
      },
      final(cb) {
        try {
          if (!clienteSeFue()) raw.end();
        } catch {
          /* conexion ya cerrada */
        }
        cb();
      },
    });
    salida.on('error', () => {
      try {
        zlibStream.destroy();
      } catch {
        /* ya destruido */
      }
    });

    // Al cerrarse la conexion: detener la compresion y liberar los callbacks de escritura pendientes
    // para que `send` (pipe de estaticos) no quede esperando un 'drain' que nunca llegara.
    res.once('close', () => {
      try {
        zlibStream.destroy();
      } catch {
        /* ya destruido */
      }
      const q = onwritePendientes;
      onwritePendientes = [];
      for (const cb of q) {
        try {
          cb();
        } catch {
          /* ignorar */
        }
      }
    });

    // Backpressure: cuando zlib drena, despertar el pipe de `send` (res
    // emite 'drain') y ejecutar los callbacks de escrituras pendientes.
    zlibStream.on('drain', () => {
      res.emit('drain');
      const q = onwritePendientes;
      onwritePendientes = [];
      for (const cb of q) cb();
    });
    zlibStream.on('error', () => {
      try {
        res.destroy();
      } catch {
        /* ya destruido */
      }
    });
    zlibStream.pipe(salida);

    comprimiendo = true;
    return true;
  }

  return new Proxy(res, {
    get(target, prop) {
      switch (prop) {
        case 'writeHead':
          // Si aún no se decidió, se decide al momento de enviar cabeceras.
          return (...args) => {
            if (!comprimiendo) iniciarCompresion();
            const url = String(req.url || '');
            const cc = cabeceraCache(url);
            if (cc) raw.setHeader('cache-control', cc);
            return raw.writeHead(...args);
          };
        case 'setHeader':
          return (name, value) => {
            const nom = String(name).toLowerCase();
            if (nom === 'content-type') {
              tipoContenido = String(value);
            }
            if (comprimiendo && nom === 'content-length') {
              return res;
            }
            if (nom === 'cache-control') {
              const url = String(req.url || '');
              const cc = cabeceraCache(url);
              if (cc) return raw.setHeader(name, cc);
            }
            return raw.setHeader(name, value);
          };
        case 'removeHeader':
          return (name) => raw.removeHeader(name);
        case 'write':
          return (chunk, enc, cb) => {
            if (!comprimiendo) iniciarCompresion();
            if (!comprimiendo) {
              if (typeof enc === 'function' && cb === undefined) {
                return raw.write(chunk, enc);
              }
              return raw.write(chunk, enc, cb);
            }
            if (zlibStream.destroyed || res.destroyed) {
              if (typeof cb === 'function') cb();
              return true; // cliente ausente: se descarta, sin bloquear al emisor
            }
            if (typeof cb === 'function') onwritePendientes.push(cb);
            return zlibStream.write(chunk);
          };
        case 'end':
          return (chunk, enc, cb) => {
            if (!comprimiendo) {
              if (typeof enc === 'function' && cb === undefined) {
                return raw.end(chunk, enc);
              }
              return raw.end(chunk, enc, cb);
            }
            if (zlibStream.destroyed || res.destroyed) {
              if (typeof cb === 'function') cb();
              return res;
            }
            if (chunk != null && chunk.length) zlibStream.end(chunk);
            else zlibStream.end();
            if (typeof cb === 'function') onwritePendientes.push(cb);
            return res;
          };
        default:
          return Reflect.get(target, prop);
      }
    },
    set(target, prop, value) {
      return Reflect.set(target, prop, value);
    },
  });
}

export { crearProxyRespuesta };