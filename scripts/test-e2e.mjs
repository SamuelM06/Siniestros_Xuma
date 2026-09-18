// Pruebas E2E de seguridad: levanta el servidor SSR y valida el flujo completo.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = 'http://127.0.0.1:4399';
let log = '';
let cocinas;

const child = spawn(process.execPath, [join(ROOT, 'dist', 'server', 'entry.mjs')], {
  cwd: ROOT,
  env: { ...process.env, PORT: '4399' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (d) => { log += d; });
child.stderr.on('data', (d) => { log += d; });

function resultado(nombre, ok, detalle = '') {
  console.log(`${ok ? '✅' : '❌'} ${nombre}${detalle ? ' :: ' + detalle : ''}`);
  cocinas = cocinas && ok;
}

async function esperarServidor(t = 20000) {
  const ini = Date.now();
  while (Date.now() - ini < t) {
    try {
      const r = await fetch(`${BASE}/login`);
      if (r.status === 200) return true;
    } catch { /* reintenta */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function postLogin(u, p) {
  const form = new FormData();
  form.set('username', u);
  form.set('password', p);
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    body: form,
    headers: { origin: BASE, 'sec-fetch-site': 'same-origin' },
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const m = /xuma_sesion=([^;]+)/.exec(setCookie);
  return { status: res.status, cookie: m ? `xuma_sesion=${m[1]}` : null, setCookie };
}

async function main() {
  if (!(await esperarServidor())) {
    console.log('❌ El servidor no arrancó a tiempo.');
    console.log(log.slice(-2000));
    child.kill();
    process.exit(1);
  }

  // 1. Páginas sin sesión → redirigen a /login
  let res = await fetch(`${BASE}/`, { redirect: 'manual' });
  resultado('GET / sin sesión → 302 a /login', res.status === 302 && (res.headers.get('location') ?? '').endsWith('/login'), `status=${res.status}`);

  res = await fetch(`${BASE}/estatus`, { redirect: 'manual' });
  resultado('GET /estatus sin sesión → 302 a /login', res.status === 302, `status=${res.status}`);

  res = await fetch(`${BASE}/dashboard`, { redirect: 'manual' });
  resultado('GET /dashboard sin sesión → 302 a /login', res.status === 302, `status=${res.status}`);

  // 2. API sin sesión → 401
  res = await fetch(`${BASE}/api/kpis`);
  resultado('GET /api/kpis sin sesión → 401', res.status === 401, `status=${res.status}`);

  // 3. Login incorrecto → 401
  res = await postLogin('analista', 'clave_mala');
  resultado('POST login con clave incorrecta → 401', res.status === 401, `status=${res.status}`);

  // 4. Login correcto → 200 y cookie httpOnly
  // (la clave real se lee de E2E_PASS para no dejar credenciales en el repo)
  const E2E_PASS = process.env.E2E_PASS ?? '';
  if (!E2E_PASS) {
    console.log('⏭️  E2E_PASS no definida — se omiten las pruebas de datos autenticados');
    console.log('    Pruébalas con: $env:E2E_PASS=\"tuclave\"; node scripts/test-e2e.mjs');
    console.log('\nResultado global: capa anónima OK, lo autenticado se omitió.');
    child.kill();
    process.exit(0);
  }
  res = await postLogin('analista', E2E_PASS);
  const httponly = /httpOnly/i.test(res.setCookie);
  const samesiteLax = /SameSite=Lax/i.test(res.setCookie);
  resultado('POST login correcto → 200 + cookie (httpOnly + SameSite=Lax)', res.status === 200 && !!res.cookie && httponly && samesiteLax, `status=${res.status}`);
  const sesion = res.cookie;

  // 5. API con sesión → 200 y datos reales
  res = await fetch(`${BASE}/api/kpis`, { headers: { cookie: sesion } });
  let kpis = null;
  if (res.ok) {
    const body = await res.json();
    kpis = body;
  }
  resultado(
    'GET /api/kpis con sesión → 200',
    res.status === 200 && kpis && typeof kpis.total === 'number',
    kpis ? `total=${kpis.total} pagados=${kpis.pagados} objetados=${kpis.objetados} docs=${kpis.solicitudDocs} pagadoCOP=${kpis.totalPagado}` : `status=${res.status}`,
  );

  // 6. Datos de gráficos y metadatos con sesión
  const [tend, asig, gas, prod, meta] = await Promise.all(
    ['tendencia', 'por-aseguradora', 'por-gasera', 'por-producto', 'metadatos'].map(async (e) => {
      const r = await fetch(`${BASE}/api/${e}`, { headers: { cookie: sesion } });
      const body = await r.json().catch(() => null);
      const arr = Array.isArray(body) ? body : null;
      return { ok: r.ok, n: arr?.length, keys: body && typeof body === 'object' && !arr ? Object.keys(body) : undefined };
    }),
  );
  resultado(
    'Endpoints de gráficos y metadatos OK',
    tend.ok && asig.ok && gas.ok && prod.ok && meta.ok && tend.n > 0 && asig.n > 0 && gas.n > 0 && prod.n > 0,
    `tendencia=${tend.n} aseguradora=${asig.n} gasera=${gas.n} producto=${prod.n} meta.keys=${meta.keys?.join(',') ?? meta.n}`,
  );

  // 7. Tabla paginada
  res = await fetch(`${BASE}/api/tabla?page=1&size=10`, { headers: { cookie: sesion } });
  let tabla = null;
  if (res.ok) tabla = await res.json();
  resultado('GET /api/tabla con sesión → 200', res.status === 200 && tabla && Array.isArray(tabla.registros) && tabla.registros.every((r) => !('cedula' in r)), `total=${tabla?.total} filas=${tabla?.registros?.length} (sin campos sensibles)`);

  // 8. Dashboard renderizado con sesión
  res = await fetch(`${BASE}/dashboard`, { headers: { cookie: sesion } });
  const html = await res.text();
  resultado('GET /dashboard con sesión → 200 (HTML)', res.status === 200 && html.includes('Tablero de siniestros'), `status=${res.status} bytes=${html.length}`);

  // 8b. API de estatus y vista de estatus con sesión
  res = await fetch(`${BASE}/api/estatus?anio=2026`, { headers: { cookie: sesion } });
  let est = null;
  if (res.ok) est = await res.json();
  resultado(
    'GET /api/estatus con sesión → 200 (matriz gasera x mes)',
    res.status === 200 && est && Array.isArray(est.filas) && Array.isArray(est.gaseras) && typeof est.anio === 'number' && est.gaseras.length > 0,
    est ? `anio=${est.anio} gaseras=${est.gaseras.length} filas=${est.filas.length}` : `status=${res.status}`,
  );

  res = await fetch(`${BASE}/estatus`, { headers: { cookie: sesion } });
  const estHtml = await res.text();
  resultado('GET /estatus con sesión → 200 (HTML)', res.status === 200 && estHtml.includes('Estatus'), `status=${res.status} bytes=${estHtml.length}`);

  // 9. Headers de seguridad presentes
  res = await fetch(`${BASE}/dashboard`, { headers: { cookie: sesion } });
  const hs = res.headers;
  resultado(
    'Headers de seguridad presentes',
    hs.get('x-frame-options') === 'DENY' &&
      hs.get('x-content-type-options') === 'nosniff' &&
      hs.get('content-security-policy')?.includes("default-src 'self'") &&
      hs.get('referrer-policy') === 'no-referrer',
    `CSP=${(hs.get('content-security-policy') ?? '').slice(0, 40)}…`,
  );

  // 10. Sesión inválida → 401
  res = await fetch(`${BASE}/api/kpis`, { headers: { cookie: 'xuma_sesion=12345.firma' } });
  resultado('API con token manipulado → 401', res.status === 401, `status=${res.status}`);

  console.log('\nResultado global: ' + (cocinas ? 'TODAS LAS PRUEBAS PASARON 🎉' : 'HAY FALLOS ⚠️'));
  child.kill();
  process.exit(cocinas ? 0 : 1);
}

cocinas = true;
await main().catch((e) => { console.error('Error de prueba:', e.message); console.log(log.slice(-1500)); child.kill(); process.exit(1); });