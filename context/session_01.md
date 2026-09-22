# Contexto del día — Dashboard de Siniestros Xuma 2026

> Fecha: lunes 21 de septiembre de 2026
> Sesión: rendimiento, animaciones y conectividad de filtros en mapa/dashboard

---

## Resumen del día

Día dedicado a dejar de un solo golpe el front de carga lenta y las animaciones
"raras" en las vistas de datos, y a cerrar la conexión filtros ↔ mapa. Al final
del día el dashboard, el mapa y la tabla quedaron respondiendo en ~6–11 ms
(antes 2.000 ms en frío).

---

## 1. Perf general: mapa y dashboard (commit `565a43d`)

Problemas de origen:

- La tabla `siniestros.casos` (Azure) tiene +41.600 registros y **no tiene índice
  en `fecha_radicacion`**; el usuario de BD no tiene permisos para crearlo. Cada
  página obligaba a PostgreSQL a escanear las 41.600 filas ejecutando expresiones
  regulares pesadas sobre los campos JSON (`datos_originales`).
- Tormenta de consultas paralelas en frío: al cargar dashboard o metadatos en SSR
  se disparaban hasta 12 SQL casi al mismo milisegundo; el pool `pg` sobre SSL solo
  tenía 5 conexiones y las cerraba tras 30 s de inactividad → las consultas hacían
  fila y saturaban el túnel a Azure (demoras de 2–4 s).
- Caché anterior de solo 60 s: si la persona recargaba a los 65 s, volvía el martirio.
- El geojson de municipios pesa ~1.34 MB y se volvía a descargar y re-parsear en
  cada recarga.

La "cirugía" aplicada:

- **Stale-while-revalidate en RAM**: caché con TTL de horas; si envejece, entrega el
  dato en ~5 ms y refresca solo y en silencio en segundo plano.
- **Precalentamiento automático (warmup)**: al arrancar el servidor se ejecutan las
  consultas y la memoria queda llena antes de que alguien abra el navegador.
- **Consultas SQL consolidadas**: se redujo el escaneo de 41.000 filas a un filtro
  intermedio de ~4.000 filas (2026).
- **Túnel de BD siempre caliente**: pool con mínimo 2 conexiones vivas y heartbeat
  cada 45 s para que Azure nunca desconecte.
- **Caché en `sessionStorage`**: el mapa de Colombia queda en la memoria de la
  pestaña; al recargar no descarga nada.

Resultado: de >2.000 ms a 6–11 ms.

## 2. Fix de servidor (commit `01322bf`)

- Habilitar `allowedHosts` para acceso por IP (tailwind v4 / vite) y blindar el
  `rangoFechas` en la página de inicio.

## 3. Vista Detalle (commit `2666168`)

Tres correcciones:

1. **Animación de la tabla**: se quitó el reordenamiento (layout/popLayout) y se usa
   `AnimatePresence mode="wait"` + `motion.tbody` con `key` por página/tamaño/filtros,
   filas estáticas y solo fundido (desaparece/carga) sin que los registros "suban".
2. **Filtro aseguradora aplicado a la tabla**: el filtro ya existía en el panel pero
   no se enviaba ni filtraba. Se agregó `aseguradora` al `queryString` (fetcher.ts),
   a `parseFilters` (query.ts) y la condición `aseguradora_norm = $n` en
   `construirWhere`.
3. **Fechas de mes con último día real**: se eliminó la constante fija `ULTIMO_DIA`
   (Feb 29 hardcodeado). Nueva función `ultimoDiaMes()` que calcula el último día
   real del mes respetando años bisiestos, y el SQL usa límite superior exclusivo
   `fecha_radicacion < ($fecha::date + interval '1 day')`. `parseFecha` valida ahora
   fechas reales (round-trip), evitando el error de `2026-02-29` que devolvía 500.

## 4. Vista Estatus (commit `20a9a3e`)

- Mismo patrón de animación que la tabla de detalle: matriz gasera × mes con
  `AnimatePresence mode="wait"` + `motion.tbody` con `key` por filtros y filas
  estáticas, solo fundido al recargar (antes `popLayout` reordenaba las filas).

## 5. Normalizar nombres del asegurado

- En la tabla de /detalle el nombre del asegurado se muestra con las **iniciales en
  mayúscula** (formato de título), evitando nombres completos en minúscula o todo en
  mayúscula.

## 6. Conectar filtros del mapa (commit `5de3f86`)

- Los filtros del panel superior **sí afectan al mapa**: al cambiar filtros se
  recarga la consulta territorial y colorea/agrega los datos por departamento y el
  segmentador lateral, sincronizados con el estado global de filtros.

## 7. Filtros por encima de tarjetas y gráficos

- Se ajustó el layout para que los filtros queden **por encima** de las tarjetas KPI
  y de los gráficos en todas las páginas (antes quedaban tapados/no visibles).

---

## Pendientes abiertos

- Normalización definitiva de estados de siniestros (4 estados objetivo) — esperando decisión.
- E2E (`scripts/test-e2e.mjs`) roto mientras el login siga deshabilitado.

---

## Referencias

- Arquitectura, stack y seguridad: `context/plan-desarrollo.md`
- Recorrido funcional de la app: `context/walkthrough.md`
- Esquema de BD: `context/docs/esquema-siniestros.md`
- Conexión a la BD: `context/docs/conexion-bd.md`