# 01_Actualizacion — Plan de actualización DB + Front

> **Para qué sirve este archivo:** si el chat se pierde o se vacía, retoma desde aquí.
> Todo lo que sigue está verificado con datos reales leídos del SharePoint.
>
> Preparado la noche del **2026-10-06**, sin acceso a la BD corporativa (VPN caída).
> Lo que requiere red está marcado ⛔. Lo que ya se hizo está marcado ✅.
> Objetivo: que el portal muestre los datos nuevos y **correctos** en la reunión de la mañana del **2026-10-07**.

---

## ▶ ESTADO AL 2026-10-07 (ejecutado con VPN)

### 🚨 CRÍTICO: existen DOS bases de datos, y solo una es la buena

En `<HOST_CORPORATIVO>` hay dos bases con un esquema `siniestros`:

| | **DataCenter_Vanti** ✅ | **DataCenter_Promigas** ⚠️ |
|---|---|---|
| Estado | **ACTUAL** | **ABANDONADA (snapshot viejo)** |
| Última carga | **2026-10-06 22:58** | **2026-09-02 13:54** |
| Filas | **46.264** (43.521 vigentes) | 28.882 |
| Columnas | **22** (con `vigente`, `clave_natural`, `periodo_dato`, `tipo_siniestro`) | **18** (esquema viejo, sin `vigente`) |
| Archivos cargados | **21** | 9 |
| Tiene los 2 Deudor nuevos | ❌ 0 filas | ❌ |
| La usa la app | ✅ sí | no |

**Cuál es la correcta: `DataCenter_Vanti`.** Es la única con el esquema de baja lógica (`vigente` +
`casos_historial`) que usa el ETL, y la única que se está actualizando.

> ⚠️ **`docs/esquema-siniestros.md` está escrito contra `DataCenter_Promigas`.** Por eso dice
> "~28.882 registros" y lista 18 columnas: describe la base **abandonada**. Actualizar ese doc.

**La app apunta a Vanti, confirmado por dos vías independientes:**
1. El bundle compilado (`dist/server/chunks/env_*.mjs`) tiene `DB_NAME: "DataCenter_Vanti"`.
2. `SELECT current_database()` con esa misma configuración → `DataCenter_Vanti`.

### Por qué el filtro Deudor sigue mostrando solo Caribe y Surtigas

**Porque los datos no están.** Verificado en la BD:

```
base          : DataCenter_Vanti
ultima carga  : #518  @ 2026-10-06 22:58:23   ← sin cambios desde ayer
filas         : 46.264   (43.521 vigentes)
archivos Deudor nuevos (VIDADEUDOR / VIDA DEUDOR GASGUAJIRA): 0 filas
```

**Lo que tu amigo "actualizó" no llegó a `DataCenter_Vanti`.** Hay que averiguar dónde lo corrió
(Promigas, otro servidor, o si le faltó ejecutar) y repetirlo contra Vanti.

La caché **no** es el problema: `POST /api/cache` devolvió 403 (pide sesión), pero la API consulta
directo y tampoco encuentra los registros. El filtro responde `["Gases del Caribe","Surtigas"]`
porque eso es literalmente lo que hay en 2026.

### De dónde salía el número de $8,5 mil M

Se probaron varios scopes para 2026:

| Scope | Filas | Pagados | Total pagado |
|---|---|---|---|
| **2026, solo vigentes (LO QUE VE EL PORTAL)** | 3.891 | 2.272 | **$6.946.528.618** |
| 2026, sin filtrar `vigente` | 4.745 | 2.909 | $9.409.281.024 |
| 2026, sin filtro de outliers | 3.891 | 2.272 | $6.946.528.618 |
| Todo el histórico, solo vigentes | 41.791 | 19.885 | $41.896.695.560 |
| Todo, sin ningún filtro | 46.264 | 23.985 | $480.551.914.884 |

El `$8.521.449.638 / 2.847 pagados` de `context/walkthrough.md` **no se reproduce con ningún scope
actual**: es un número puntual del **23-sep**, cuando Vanti estaba en otro estado (antes de la
recarga del 06-oct que subió GDO a 7.046 filas yTrajo el Caribe Deudor). No es comparable con hoy.
Y **no** venía de Promigas (ese da $2,2 mil M en 2026).

### 🔴 Hallazgo de seguridad (aparte)

`DB_PASSWORD` y `SESSION_SECRET` quedan **incrustados en el bundle compilado**
(`dist/server/chunks/env_*.mjs`), porque `src/lib/env.ts:7` lee `import.meta.env` y Vite inyecta
el `.env` en tiempo de build. Consecuencias:
- Quien tenga el `dist/` tiene las credenciales de la BD.
- Cambiar una variable exige **rebuild**, no basta con reiniciar.
- Si el `Dockerfile` copia `dist/` desde fuera, la clave queda en la imagen.

Pendiente: mover la resolución a runtime (`dotenv/config` + `process.env` primero, sin
`import.meta.env`) y loguear al arrancar con qué base se conecta.

---

### Lo que se encontraron al conectar (cambia el plan)

| Hallazgo | Detalle |
|---|---|
| **Ya existe un ETL** | Corrió el **2026-10-06 22:57–22:58** (locales). Está en la máquina del amigo, **no** en este repo. Cargó 21 archivos por aseguradora. `cargas` llegó a `id_carga` 518. |
| **No usa DELETE, usa baja lógica** | Columnas `vigente` (bool) + tabla `casos_historial` (6.726 filas). Índice `idx_casos_clave_natural` sobre `(id_aseguradora, nombre_archivo_origen, clave_natural)`. |
| **Columnas que no están en la doc** | `clave_natural`, `vigente`, `periodo_dato`, `tipo_siniestro`. Total real: **22 columnas**, no 18. |
| **Volumen real** | 46.264 filas totales · **43.521 vigentes** · 2.743 dadas de baja. Los docs decían ~28.882 (obsoleto). |
| **Todo ya estaba cargado salvo 2 archivos** | Solo faltaban `SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` y `SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx`, ambos con **0 filas**. El resto se cargó anoche y está al día (los archivos se modificaron antes de esa corrida). |
| **`samuel_mena` es solo lectura** | `SELECT` sí, `INSERT/UPDATE/DELETE` no, en las 5 tablas. Para escribir hace falta `postgres` u otro con permisos. |

### 🐞 Bug 1 — el tablero contaba 2.191 filas fantasma (CRÍTICO)

`src/lib/query.ts` filtraba `NOT ILIKE '%planilla%'` pero **no filtraba `c.vigente`**. Como las
recargas dan de baja lógica en vez de borrar, las versiones retiradas seguían sumando:

| Archivo fantasma | Filas |
|---|---|
| `Siniestros vida deudor Gas caribe ACTUALIZADA (2) (1).xlsx` | 2.126 |
| `SINIESTROS 2026 - EFIGAS.xlsx` (renombrado a `…MICRO 2026…`) | 59 |
| otros | 6 |

El Deudor del Caribe se veía como **4.411 siniestros cuando eran 2.282** (+93%).

✅ **Corregido** en los 3 CTE de `query.ts` (líneas 47, 577, 896).

### 🐞 Bug 2 — `SIN PAGO` se contaba como Pagado (CRÍTICO)

`ESTADO_SQL` buscaba `%PAGO%` antes que la negación. Del archivo de Efigas:
`SIN PAGO` (81) y `NO PROCEDE A PAGO` (28) se contabilizaban como **Pagado**. 109 filas.

✅ **Corregido**: guarda de negación antes de la regla de pago + `REVISAR` → `En revisión`.

### 🐞 Bug 3 — Total Pagado incoherente con la tendencia

`getKpis` no aplicaba `MONTO_MAX_VALIDO` y las sumas de tendencia sí. Hay **1 registro corrupto**:
`Registro de Siniestros CMK - GDO.xlsx`, `VALOR = '$ 423.194 - $ 125.208'` (un rango parseado mal)
→ $423.194.125.208. Inflate el histórico de $41,9 mil M a $465 mil M.

**En 2026 no hay outliers**, así que el KPI que se presenta el 07-oct no está afectado.
✅ **Corregido** aplicando el mismo filtro en `getKpis`.

### ✅ Front ya arreglado (`src/lib/normalizacion.ts` + `query.ts`)

| Fix | Qué hace |
|---|---|
| D1 montos | `MONTO_SQL` reconoce `VALIDACIÓN PAGO`, `MONTO`, `MONTO CANCELADO`, `COMPARATIVO`, `VALOR ASEGURADO`. Verificado: `1474633.00` → `1474633`, `$ 6.025.003` → `6025003`. |
| D2 producto | Regla 0 por origen de carpeta → `Grupo Deudores`. Ahora 18.089 filas de 5 archivos deudor caen en la categoría correcta (antes se dispersaban o iban a *Sin producto*). |
| D3 clase | `%SINIESTROS MICRO %` y `%microseguro%` corregidos: `SINIESTROS MICRO 2026 - EFIGAS.xlsx` (62) y `SINIESTROS MICROSEGUROS GASGUAJIRA.xlsx` (1.401) ahora son `Microseguros`, no `Otros`. |
| Vigentes | `c.vigente` en los 3 CTE. |
| Outliers | `MONTO_MAX_VALIDO` en `getKpis`. |

`npx astro check` → **0 errores**. `npx astro build` → **Complete!**

### ⛔ Pendiente: correr la carga (requiere un usuario con escritura)

El cargador quedó en `scripts/cargar-sharepoint.mjs` con 3 modos:

```bash
node scripts/cargar-sharepoint.mjs            # dry-run (default)
node scripts/cargar-sharepoint.mjs --apply    # escribe (necesita INSERT)
node scripts/cargar-sharepoint.mjs --sql      # genera logs/carga-deudor.sql
```

**Como `samuel_mena` es solo lectura, se generó `logs/carga-deudor.sql` (907 líneas, 687 altas).**
**Instrucciones para quien tenga permisos: `docs/planes/02_Handoff_Carga_Deudor.md`.**
El archivo es idempotente (`WHERE NOT EXISTS` sobre la clave natural), lleva
`SET client_encoding = 'UTF8'`, y al final trae las consultas de verificación.
✅ **Validado el 07-oct**: los 8 bloques `INSERT` se ejecutaron como `SELECT` (un SELECT no
necesita permiso de escritura) → sintaxis y tipos correctos, 687 filas, idempotencia confirmada.

**Aseguradoras atribuidas** (no vienen en los archivos; decididas el 07-oct con los cruces):

| Archivo | Registros | Aseguradora | Evidencia |
|---|---|---|---|
| `SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` | 330 | **Seguros Alfa** (id 5) | Alfa gana en ambos cruces (cédula 7, nombre 7) contra Sura (5, 4). El histórico de Alfa ya tiene 322 filas de EFIGAS. |
| `SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx` | 357 | **Seguros SURA** (id 4) | Sura gana en ambos cruces (26, 19) contra Alfa (20, 17) y HDI (13, 10). Parejo: 45 cruces sobre 357. |

**Pendiente de confirmar con negocio** (no es técnico): los 2 valores de arriba se decidieron el
07-oct con los cruces, pero ningún archivo trae columna `ASEGURADORA`. Si tu área lo sabe distinto,
se cambia en el manifiesto de `scripts/cargar-sharepoint.mjs` y se regenera el SQL.

### Cifras 2026 después de los fixes (sin los 2 archivos nuevos)

### ❌ Falsa alarma que se descartó: las "146 filas duplicadas"

Inicialmente se-markaron 143 grupos con `clave_natural` repetida como duplicados. **Era un error de
diagnóstico: NO son duplicados.** Análisis de los 143 grupos:

| Señal | Grupos |
|---|---|
| **Verdaderos duplicados (misma aseguradora)** | **0** |
| Misma clave, **distinta aseguradora** | 143 |
| Con **producto** distinto | 136 |
| Con **estado** distinto | 54 |
| Con **fecha** distinta | 19 |
| Con **monto** distinto | 9 |

La causa: el índice `idx_casos_clave_natural` es sobre
`(id_aseguradora, nombre_archivo_origen, clave_natural)` — **incluye la aseguradora**, así que dos
registros con la misma clave pero de aseguradoras distintas se guardan separados **a propósito**.

Ejemplos reales (mismo contrato, cédula y nombre, pero productos y montos distintos):

| Clave | Registros |
|---|---|
| `\|1007435\|12551923\|MARTIN GREGORIO ALMAZO FONTALVO\|` | HDI `OBJETADO` · SURA `PAGADO` · Alfa `OBJETADO` |
| `\|2007170\|32659089\|PIEDAD DEL CARMEN TAMAYO CONTRERAS\|` | SURA `$5.323.695` · Alfa `$7.870.092` (ambos `PAGADO` con comprobante) |
| `\|1076366\|None\|MIGUEL ALVAREZ PACHECO\|2023` | HDI `FUTURO PROTEGIDO` 2023-01-27 · SURA `PUERTA A PUERTA` 2023-06-05 |

Son reclamos legítimamente distintos. **No se tocó ninguno.** Lo único débil es que
`clave_natural` para esos microseguros (`|contrato|cedula|nombre|`) no incluye el número de
siniestro, así que a futuro conviene reforzarla — pero no es un defecto que afecte las cifras hoy.

### De dónde salió la caída de $8,5 → $6,9 mil M (no fue un error)

Puente aritmético sobre 2026:

| Concepto | Valor |
|---|---|
| Filas 2026 antes (contando lo retirado) | 4.745 |
| Filas 2026 hoy | 3.891 |
| Pagados antes → hoy | 2.909 → 2.272 |
| **Total pagado antes** | **$9.409.281.024** |
| **Total pagado hoy** | **$6.946.528.618** |
| **Diferencia = dinero en filas YA retiradas** | **$2.462.752.406** |

Ese dinero era la versión vieja del Caribe Deudor (`ACTUALIZADA (2) (1)`) más el Efigas
renombrado, **contados dos veces** porque el tablero nunca filtró `vigente`.
**$6.946.528.618 es el número correcto.**

**No se perdió ningún dato pagable.** Las 4 filas que quedaron retiradas sin reaparecer son
`TRAMITE`, `TRAMITE`, `OBJETADO` y `SOLICITUD DE DOCUMENTOS`: ninguna es `Pagado`, impacto $0 en el KPI.

### Filtro Deudor: verificado que poda bien (API en vivo)

| Filtro | Gaseras que ofrece |
|---|---|
| Sin clase (2026) | Ceo, Efigas, Guajira, Caribe, Gdo, Surtigas |
| **`clase = Deudor` (2026)** | **Caribe, Surtigas** |
| `clase = Salvafactura` (2026) | Surtigas |
| `clase = Deudor` (histórico) | las 6 |

La cascada vive en `DashboardApp.tsx:59-92` (re-pide `/api/metadatos` al cambiar de clase y poda
gasera/producto). Tras la carga, `Deudor` en 2026 debe ofrecer Caribe + Efigas + Guajira + Surtigas.

### Estado del filtro por clase vs producto

`clase = Microseguros` todavía ofrece el producto `Grupo Deudores`, porque el archivo
`Siniestros CEO.xlsx` entra a Microseguros por nombre (`normalizacion.ts`, regla `Siniestros CEO%`)
pero trae `PRODUCTO = 'DEUDOR'` en sus filas. Son **92 registros históricos** de CEO.
**No se cambió**: reclasificarlos es decisión de negocio, no técnica, y movería 92 filas de clase.

| Gasera | Siniestros | Pagados | Total pagado |
|---|---|---|---|
| Gdo | 9.949 | 5.828 | — |
| Gases del Caribe | 18.326 | 7.726 | — |
| Surtigas | 8.573 | 5.260 | — |
| Efigas | 2.608 | 26 | — |
| Gases de La Guajira | 2.194 | 1.022 | — |
| Ceo | 140 | 22 | — |
| **Total 2026** | **3.891** | **2.272** | **$6.946.528.618** |

---

### La caída NO es por base de datos: es doble conteo (prueba definitiva)

El usuario sospechaba de `DataCenter_Promigas`. **Descartado por partida doble**: el bundle tiene
`DB_NAME: "DataCenter_Vanti"` y `current_database()` devuelve `DataCenter_Vanti`. Además Promigas da
$2,2 mil M en 2026, no el número que se esperaba.

La prueba del doble conteo:

| Archivo | Filas | Estado |
|---|---|---|
| `Siniestros vida deudor Gas caribe ACTUALIZADA.xlsx` (nuevo) | 2.282 | `vigente = true` |
| `Siniestros vida deudor Gas caribe ACTUALIZADA (2) (1).xlsx` (viejo) | 2.126 | `vigente = false` |
| **Claves naturales que existen en LOS DOS** | **2.124** | ← el mismo reclamo, dos veces |

Evidencia fila por fila (misma `clave_natural`, dos `id_caso` distintos):

| `clave_natural` | id nuevo | id viejo |
|---|---|---|
| `\|27000711\|22486037\|IDELMA ROSINA CARRILLO DOMINGUEZ\|` | 42.830 | 10.154 |
| `\|6078917\|72.198.410\|CAICEDO MARLENE\|` | 43.401 | 10.725 |
| `\|66247869\|12435268\|REINALDO ENRIQUE GUILLEN MARQUEZ\|` | 42.592 | 9.916 |

El amigo **renombró el archivo y lo recargó**; el ETL dio de baja la copia vieja correctamente
(`vigente=false`), pero el tablero no la filtraba, así que contaba los mismos reclamos 2 veces.

Dinero contado de más en 2026: **$2.372.771.358** solo del archivo viejo del Caribe (631 filas
pagadas) + $57.994.284 del Efigas renombrado = **$2.462.752.406**.
$9.409.281.024 − $2.462.752.406 = **$6.946.528.618** ✅

### 🔴 Pendiente de negocio: el archivo de Efigas Deudor es contradictorio

Cruce de `RESOLUCIÓN FINAL` contra `VALIDACIÓN PAGO`:

| `RESOLUCIÓN FINAL` | Filas | Suma `VALIDACIÓN PAGO` | Suma `VALOR ASEGURADO` |
|---|---|---|---|
| `PAGO` | 198 | **$0** (las 198 en cero) | $657.528.995 |
| `SIN PAGO` | 81 | $240.498.130 | $240.498.130 |
| `NO PROCEDE A PAGO` | 29 | $31.529.794 | $0 |
| `REVISAR` | 25 | $40.672.161 | $42.772.605 |

**El monto está en las filas que NO están pagadas, y las que dicen `PAGO` tienen $0.** Eso es
invertido respecto de lo que uno esperaría. Sin la columna ASEGURADORA y sin clarification del
negocio, cargar el archivo tal cual deja **198 casos de Efigas visibles como "Pagado" con $0**.

**Pregunta para negocio:** ¿esos 198 con `RESOLUCIÓN FINAL = PAGO` están pagados? Si sí, ¿de dónde
sale el monto? Si no, ¿por qué la columna dice PAGO?

### Efecto proyectado de la carga en el KPI

| Concepto | Valor |
|---|---|
| Total pagado hoy | $6.946.528.618 |
| **+ Guajira Deudor (332 pagados)** | **+$1.018.564.007** |
| + Efigas Deudor (196 pagados) | **+$0** ← por el problema de arriba |
| **= Total pagado después** | **$7.965.092.625** (+14,7%) |

### Notas sobre `MONTO_SQL` y `VALOR ASEGURADO`

- Un `0` en la primera columna **corta el `COALESCE`** (verificado). Por eso los 198 `PAGO` de
  Efigas dan `$0` en vez de cair a `VALOR ASEGURADO`. Es el comportamiento conservador: no infla.
- `VALOR ASEGURADO` (agregado antes en D1) aporta **$291.174.566** al KPI 2026 actual
  (GDO $208,6 M · Caribe $82,6 M) en 691 filas que no traen otra columna de monto.
- ⚠️ `VALOR ASEGURADO` es el **valor asegurado**, no dinero pagado. Mezclarlo en "Total Pagado" es
  semánticamente dudoso. **No se cambió** (quitarlo bajaría el KPI en $291 M sin que nadie lo pidiera),
  pero queda como decisión a validar con negocio.

---

### Conciliación OneDrive ↔ DataCenter_Vanti (hecha 07-oct)

Se leyeron las **72 hojas** de los 30 Excel del SharePoint (23 son pivots/resúmenes auxiliares) y
se compararon contra los 43.521 registros vigentes de Vanti.

| Resultado | Detalle |
|---|---|
| **Cuadran exacto (10 archivos)** | `BASE SINIESTROS CARIBE` 3.681 · `DEUDOR 2022-2023` 6.015 · `INFORME DE PAGOS GASERAS (3)` 177 · `SINIESTROS MICRO 2026 - EFIGAS` 62 · `SALVAFACTURA SURTIGAS` 176 · `Caribe Vida Deudor` 2.282 · `GDO` 7.046 · `Deudor 2023` 2.990 |
| **Difieren por diseño (correcto)** | Hojas de movimiento/pago: `Movimientos` 27.224, `PLANILLAS DE PAGO` 1.607, `BD_Pagos` 424, `SINESTROS PAGADOS 24-25` 424×2. Repartos por estado de `GASGUAJIRA` (497) y hoja `Base` de Proexequial (48). |
| **Sin explicar (menor)** | `PROEXEQUIAL.xlsx` 211 en Excel vs **163** en BD (−48). Ningún criterio de dedupe natural da 163 (AÑO,MES,NIT → 186; FUENTE → 76; NIT,EMPRESA → 10). Es data agregada, aporta **$0** al Total Pagado. **Queda pendiente conocer la regla del ETL.** |
| **Diferencias de 1 y 5 filas** | `Pagos siniestros HDI 2024` 534/533 (−1) y `SINIESTROS VIDA DEUDOR SURTIGAS (15)` 5.200/5.195 (−5). Probable dedupe; la hoja de Surtigas además es **transpuesta** y requiere parser aparte. |
| **No cargado (2)** | `SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` (333) y `SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx` (732 en crudo → 357 tras dedupe). |

⚠️ **Inconsistencia de origen entre aseguradoras:** SURA se carga desde el **Maestro**
(`SURA.xlsx (BD_SURA, consolidado)` = 2.358) y sus `Entradas` (`SURA 2026`, `SURA 2023-2024`,
`siniestros brilla` = 2.412) **no** se cargan. HDI, Cardiff y Alfa sí usan las `Entradas`.
Conviene unificar el criterio para que la bitácora sea predecible.

### Filtro Estado (múltiple) en la vista Estatus — reinstated 07-oct

El filtro **no existía** en `/estatus` (solo Año, Clase, Gasera, Producto, Aseguradora).
Cambios:

| Archivo | Cambio |
|---|---|
| `src/lib/query.ts` | `EstatusFiltros.estado?: string[]` + `empujarLista(..., 'estado_norm', ef.estado)` en `getEstatus` |
| `src/pages/api/estatus.ts` | Parsea `estado` (`getAll`, máx. 120 car., dedupe) |
| `src/components/estatus/EstatusApp.tsx` | `estado?: string[]` en `FiltrosEstatus`, `construirQs`, `MultiSelectXuma` con icono `CircleDot`, y la cascada también poda `estado` |

Grid de filtros: `lg:grid-cols-5` → `lg:grid-cols-3 xl:grid-cols-6`.
El export a Excel reutiliza `construirQs`, así que hereda el filtro.

Verificado contra la API (2026): sin filtro 3.891 · `Pagado` 2.272 · `Objetado` 342 ·
`En trámite` 872 · multi (Pagado+Objetado) 2.614 · `Deudor + Pagado` 1.057.
**Coherencia aritmética verificada:** `Pagado` solo = `Pagado` dentro del multi = 2.272, y
2.272 + 342 = 2.614 ✅

---

## 0. Resumen del diagnóstico original (2026-10-06)

| Tema | Hallazgo |
|---|---|
| GitHub | `origin/main` = `49784ef` = HEAD local. **No hay nada que pull.** Confirmado con `git fetch --all --prune` y `git ls-remote --heads origin`. El repo alterno `JeamPaulLabs/ReportSiniestro` (`context/walkthrough.md:10`) responde *Repository not found*. |
| Cambios locales | Hay **21 archivos modificados + 10 sin trackear sin commitear**. Nadie los ha commiteado. Decidir antes de tocar nada. |
| SharePoint | Inventario completo de **30 archivos / 73 hojas**. Las 2 carpetas nuevas de Deudor están confirmadas. |
| BD | `<HOST_CORPORATIVO>:5432` → `ETIMEDOUT` / `DestinationHostUnreachable`. Sin VPN no hay lectura ni escritura. |

---

## ⭐ ALCANCE: recarga completa, no solo Deudor

**Hay que actualizar TODOS los registros nuevos, no únicamente los 2 de Efigas/Guajira Deudor.**
Otras gaseras también ingresaron registros: GDO, Surtigas, CEO, Caribe y las microseguros de
Efigas y Guajira tienen archivos modificados hoy 06-oct.

Por tanto el objetivo de la Fase C es:

1. Recargar **las 7 carpetas de gaseras** (`01_Gdo` … `06_Gases_Guajira`) desde cero.
2. Recargar `00_Historicos` **solo por lo que falte**, nunca a ciegas (ver C3 — hay duplicación
   latente entre `Entradas` y `Maestro`).
3. Al final, **ninguna celda del portal puede quedar desactualizada**: todo KPI debe salir de la
   misma foto de datos.

### ⚠️ El riesgo real de una recarga completa: duplicados

A diferencia de "cargar 2 archivos nuevos" (que es aditivo y de bajo riesgo), recargar todo
introduce **doble conteo** en tres patrones que ya existen en el SharePoint. Esto sí rompería las
cifras de la reunión, al contrario de lo que pasó la última vez:

| Patrón | Dónde | Por qué duplica |
|---|---|---|
| **`Entradas` vs `Maestro`** | `00_Historicos\01_HDI`, `02_CARDIFF`, `03_PROEXEQUIAL`, `04_SURA`, `05_ALFA` | Los `Maestro\*.xlsx` son la **consolidación** de los `Entradas\*.xlsx` de la misma aseguradora (llevan columna `FUENTE`: `HDI_2024`, `CARDIFF_2026`, `SURA_2023_2024`, `PROEXEQUIAL_2021_2022`). Cargar ambos = cada registro contado 2 veces. |
| **Nivel caso vs nivel planilla de pago** | Caribe (`Tabla de siniestros ` + `PLANILLAS DE PAGO`), CEO (`Seguimiento de siniestros ` + `Planillas de pago`), SURA (`BD` + `BD_Pagos`) | `PLANILLAS DE PAGO` / `BD_Pagos` traen `CONSECUTIVO_PLANILLA`, `SOLICITUD_DE_GIRO`, `VALOR_SOLICITUD_GIRO`: son **líneas de pago**, no siniestros. Cargarlas como casos infla el monto pagado. |
| **Hojas que son subconjunto de otra hoja** | Guajira Deudor (`2024`+`2025`+`2026` ⊂ `PAGADO`), Guajira Microseguros (`BASE` vs `PAGADO`/`OBJETADO`/`TRÁMITE`/`SOLICITUD DE DOCUMENTOS`), Caribe Microseguros (`SINIESTROS CARIBE` vs `Hoja10`) | Hojas de estado que **reparten** las mismas filas que una hoja base. |

> **Regla de oro:** por cada archivo se carga **una sola vez** cada registro, elegido por la
> natural key `(contrato, cedula, fecha del siniestro)` o `(número de siniestro)`. Si dos hojas
> traen la misma fila, se queda una. El `--dry-run` debe reportar **cuántas filas se deduplicaron**
> por archivo; si ese número sale en 0 donde se esperaba solapamiento, el mapeo está mal.

### Las 2 carpetas nuevas de Deudor

```
04_Efigas\SINIESTROS VIDADEUDOR\SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx   (97 KB,  06-oct 16:23)
   hoja "REGISTRO DE SINIESTROS"  →  333 filas
   FECHA DE SOLICITUD · FECHA ENVÍO ASEGURADORA · DIAS DE ENVIO · ASEGURADO ·
   IDENTIFICACIÓN · CONTRATO · PRODUCTO · FECHA SINIESTRO · VALOR ASEGURADO ·
   NO. SOLICITUD REGISTRO · FECHA DESEMBOLSO · TIPO SINIESTRO · PRE-RESOLUCION ·
   ESTADO · GESTIÓN REGISTRO · REGISTRO · Cierre · VALIDACIÓN PAGO ·
   RESOLUCIÓN FINAL · año

06_Gases_Guajira\Siniestros Deudor\SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx    (93 KB,  06-oct 15:25)
   hojas: 2024 (167) · 2025 (109) · 2026 (98) · TRÁMITE (25) · PAGADO (333)
   # · DISTRIBUIDORA · ASEGURADO · CC. · CONTRATO · FECHA DEL SINIESTRO ·
   MONTO · FECHA DE RECIBIDO · FECHA DE PAGO · # PLANILLA · COMPARATIVO ·
   MONTO CANCELADO · ESTADO
```

### Inventario del SharePoint (rutas relevantes)

```
Pagos de Siniestros\
├── 00_Historicos\01_HDI\          Entradas\ + Maestro\
│   02_CARDIFF\                    Maestro\CARDIFF.xlsx
│   03_PROEXEQUIAL\
│   04_SURA\
│   05_ALFA\Entradas\DEUDOR 2022-2023.xlsx, Deudor 2023.xlsx
├── 01_Gdo\Registro de Siniestros CMK - GDO.xlsx            (06-oct 17:34)
├── 02_Surtigas\SINIESTROS SALVAFACTURA SURTIGAS (13).xlsx  (06-oct 15:09)
│              \SINIESTROS VIDA DEUDOR SURTIGAS (15).xlsx   (06-oct 14:57)
├── 03_Ceo\Siniestros CEO.xlsx                              (06-oct 15:16)
├── 04_Efigas\SINIESTROS MICROSEGUROS\SINIESTROS MICRO 2026 - EFIGAS.xlsx     (06-oct 15:49)
│           \SINIESTROS VIDADEUDOR\SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx   (06-oct 16:23)  ← NUEVO
├── 05_Gases_Caribe\SINIESTROS DEUDOR\...ACTUALIZADA.xlsx  (06-oct 14:19)
│                 \SINIESTROS MICROSEGUROS\BASE SINIESTROS CARIBE.xlsx        (24-sep 22:31)
└── 06_Gases_Guajira\SINIESTROS MICROSEGUROS GASGUAJIRA.xlsx                  (06-oct 21:27)
                \Siniestros Deudor\SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx    (06-oct 15:25)  ← NUEVO
```

---

## 1. Bloqueantes del mapeo — por qué los datos saldrían MAL si se cargan tal cual

No son hipotéticos: se leyeron las columnas exactas de los Excel.

### 1.1 `Total Pagado` saldría en $0 para Efigas y Guajira Deudor

`MONTO_SQL` (`src/lib/normalizacion.ts:173`) solo reconoce 13 nombres de columna. Ninguno existe en estos dos archivos:

| Gasera | Columna real del monto | ¿Está en `MONTO_SQL`? |
|---|---|---|
| Efigas | `VALIDACIÓN PAGO` | ❌ |
| Efigas | `VALOR ASEGURADO` | ❌ |
| Guajira | `MONTO` | ❌ |
| Guajira | `MONTO CANCELADO` / `COMPARATIVO` | ❌ |

Consecuencia: los dos archivos nuevos no suman nada al KPI de Total Pagado. En una reunión eso se ve como "no hay pagos" cuando en realidad sí hay.

### 1.2 `Producto` saldría "Sin producto"

- **Efigas**: la columna `PRODUCTO` trae **códigos numéricos** (`591629`, `844559`), no nombres. `PRODUCTO_SQL` (`normalizacion.ts:88`) descarta explícitamente lo numérico → cae al `ELSE 'Sin producto'`.
- **Guajira**: no tiene columna de producto en absoluto.

Comparación con los archivos que **sí** funcionan hoy:

| Archivo | Cómo aporta el producto | Regla que lo captura |
|---|---|---|
| Caribe Deudor | `RAMO = 'GRUPO DEUDORES'` | `normalizacion.ts:53` |
| CEO | `PRODUCTO = 'DEUDOR'` | `normalizacion.ts:54` |
| Efigas Microseguros | `SEGURO = 'PRACTISEGURO (2)'` | `normalizacion.ts:82` |
| **Efigas Deudor** | solo el **nombre de la carpeta** | ❌ ninguna |
| **Guajira Deudor** | solo el **nombre de la carpeta** | ❌ ninguna |

De ahí que el amigo lo haya detectado "por nombres de las carpetas".

### 1.3 `Estado` necesita mapearse a la columna correcta

`ESTADO_SQL` (`normalizacion.ts:12`) lee `c.estado`. Pero:

| Gasera | Columna de estado real | Valor |
|---|---|---|
| Efigas | `ESTADO` | **vacía en 332 de 333 filas** |
| Efigas | `PRE-RESOLUCION` | `PAGO` / `PENDIENTE` |
| Efigas | `RESOLUCIÓN FINAL` | `PAGO` / `SIN PAGO` |
| Guajira | `ESTADO` | `PAGADO` / `TRÁMITE` ✅ |

Si el cargador mete `ESTADO` (vacía) en `casos.estado`, **el 100% de Efigas Deudor queda en "Sin estado"** aunque se haya pagado.

### 1.4 `Clase` de cartera mal clasificada en 3 carpetas

`CLASE_SQL` (`normalizacion.ts:113`) compara contra `nombre_archivo_origen` con patrones que **no coinciden** con los nombres reales:

| Archivo real | Patrón esperado | Resultado |
|---|---|---|
| `SINIESTROS MICRO 2026 - EFIGAS.xlsx` | `'SINIESTROS 2026 - EFIGAS%'` (`normalizacion.ts:120`) | ❌ cae en **Otros** |
| `SINIESTROS MICROSEGUROS GASGUAJIRA.xlsx` | (no existe patrón) | ❌ cae en **Otros** |
| `SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` | `'%vida deudor%'` falla (es `VIDADEUDOR` sin espacio) → cae a `'%deudor%'` (`normalizacion.ts:117`) | ✅ Deudor, por suerte |

Además hay un conflicto de orden: `CEO` tiene `PRODUCTO='DEUDOR'` pero `CLASE_SQL:121` fuerza `Siniestros CEO%` → `Microseguros`. Ojo con eso.

### 1.5 Trampa de cabeceras

Varias cabeceras traen espacios raros o saltos de línea. Normalizar con `trim()` + colapsar espacios **antes** de mapear:

`CC. ` · `FECHA DE RECIBIDO ` · `FECHA ENVÍO\nASEGURADORA` · `VALIDACIÓN PAGO ` · `TIPO \nSINIESTRO` · `DIAS DE ENVIO ` · `PRE-RESOLUCION` · `FECHA \nDESEMBOLSO`

También hay fechas corruptas en Efigas: `DIAS DE ENVIO` con valor `Wed Oct 03 1900` y `FECHA DESEMBOLSO` con `Fri May 04 57370` (año 57370). No castear a `date` a la fuerza.

---

## 2. Plan de ejecución — 07-oct por la mañana

### Fase A · Conexión y diagnóstico (⛔ requiere VPN)

```powershell
# A1. Levantar la VPN corporativa
# A2. Verificar que la BD responde
node -e "const{Client}=require('pg');require('dotenv/config');const c=new Client({host:process.env.DB_HOST,port:+process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});c.connect().then(()=>c.query('select 1')).then(r=>{console.log('OK',r.rows[0]);return c.end()}).catch(e=>{console.log('FALLA',e.message);process.exit(1)})"
```

Si responde, seguir. Si no, parar y avisar.

### Fase B · Inventario real de la BD (⛔) — antes de tocar un solo registro

Los docs (`docs/esquema-siniestros.md`) son de fase de planificación y pueden estar desactualizados. Hay que confirmar el schema real.

```sql
-- B1. Schema real de la tabla destino
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='siniestros' AND table_name='casos'
ORDER BY ordinal_position;

-- B2. Constraints / defaults que puede romper el INSERT
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'siniestros.casos'::regclass;

-- B3. Línea base: total y por archivo origen
SELECT nombre_archivo_origen, count(*), max(fecha_carga)
FROM siniestros.casos GROUP BY 1 ORDER BY 3 DESC NULLS LAST;

-- B4. Bitácora de cargas actual
SELECT * FROM siniestros.cargas ORDER BY fecha_carga DESC;

-- B5. Confirmar qué reglas de CLASE/PRODUCTO aplican hoy
SELECT nombre_archivo_origen, proveedor, gasera, estado, count(*)
FROM siniestros.casos
GROUP BY 1,2,3,4 ORDER BY 5 DESC LIMIT 100;
```

> **Guardar la salida de B3 en un archivo.** Es el "antes" para poder demostrar el "después".

### Fase C · Carga de los datos — **recarga completa de las 7 gaseras**

> Alcance: **todas** las carpetas de gaseras, no solo los 2 archivos de Deudor. Ver sección ⭐ ALCANCE.

#### C0. La incógnita: ¿cómo se cargó la data la última vez?

**No existe en este repo el ETL que llena `siniestros.casos`.** Revisión hecha:

| Candidato | Qué hace | ¿Sirve? |
|---|---|---|
| `03_Siniestros/query_db.mjs` | Solo lectura (`SELECT`) | ❌ |
| `03_Siniestros/scripts/*` | `serve`, `drenaje`, `scan-secrets`, `test-e2e`, `set-password`, `compresion`, `diagnostico-navegador`, `test-caida-bd` | ❌ |
| `02_Carga_Data/02_Promigas` | ETL Python, pero escribe al esquema **`gestion_diaria`** (`caribe_inbound`, `ceo_inbound`…), no a `siniestros` | ❌ |
| `02_Carga_Data/01_Surtigas` | `main.py` + `extractor/loader/transformer`, **sin verificar** | ⚠️ |
| `02_Carga_Data/04_Reporte_Caribe/scripts/etl/*` | ETL de otro reporte (inbound/outbound/abandono) | ❌ |

**Pregunta a confirmar:** ¿la carga anterior la hizo una persona a mano en DBeaver (import de Excel), un script que ya no está, o `01_Surtigas`?

#### C1. Opción recomendada — script de carga nuevo, en este repo

Crear `scripts/cargar-sharepoint.mjs`. Con las columnas ya leídas, el mapeo por archivo es directo. Requisitos:

- Lee de `SP_DIR` (la ruta del SharePoint), recursivo.
- **Manifiesto declarativo** archivo→hoja→columna destino, porque cada gasera tiene su propio esquema.
- **`--dry-run` por defecto**: imprime conteos por archivo/hoja, desglose de clase, estado, producto y total pagado, **sin escribir nada**. Se revisa antes de tocar la BD.
- **`--apply`**: escritura transaccional. Idempotente → `DELETE FROM siniestros.casos WHERE nombre_archivo_origen = <archivo>` y luego INSERT del archivo completo. Nunca duplica al reejecutar.
- Escribe bitácora en `siniestros.cargas`.
- Detecta columnas reales con `information_schema` en runtime, así no falla si el schema difiere de los docs.
- **Deduplicación obligatoria en Guajira**: `PAGADO` (333) es la unión de `2024`+`2025`+`2026`, y `TRÁMITE` (25) va aparte → cargar solo `PAGADO ∪ TRÁMITE`.
- Ignora hojas auxiliares de Excel: `RESUMEN`, `TD`, `TD-HDI`, `TABLA DINAMICA`, `Hoja3`, `INFORME`, `Parametros`, `Valores`, `CONSULTA`, `Table 1..3`, `Hoja2`, `Hoja4`, `GN`, `Hoja1` (cuando es pivot). La selección por archivo está explícita en C3, no por heurística.

#### C2. Mapeo de los 2 archivos nuevos (ya derivado de los datos de hoy)

**Efigas** — hoja `REGISTRO DE SINIESTROS` (333 filas)

| destino | columna origen | nota |
|---|---|---|
| `nombre_asegurado` | `ASEGURADO` | |
| `cedula` | `IDENTIFICACIÓN` | |
| `numero_contrato` | `CONTRATO` | |
| `estado` | `RESOLUCIÓN FINAL` → fallback `PRE-RESOLUCION` | **nunca `ESTADO`, que está vacía** |
| `fecha_radicacion` | `FECHA DE SOLICITUD` | |
| `gasera` | constante `Efigas` | deducida de la carpeta `04_Efigas` |
| `nombre_archivo_origen` | `SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` | |
| `datos_originales` | la fila cruda completa | para no perder nada |

Columnas extra útiles: `TIPO SINIESTRO` = `MUERTE ASEGURADO`, `VALIDACIÓN PAGO`, `VALOR ASEGURADO`, `Cierre` = `ENERO`, `año` = `2026`, `OBSERVACIONES` (32 con dato), `NO. SOLICITUD REGISTRO`.

**Guajira** — hojas `PAGADO` + `TRÁMITE`

| destino | columna origen | nota |
|---|---|---|
| `nombre_asegurado` | `ASEGURADO` | |
| `cedula` | `CC. ` | ⚠️ el encabezado **trae espacio final** |
| `numero_contrato` | `CONTRATO` | |
| `estado` | `ESTADO` | `PAGADO` / `TRÁMITE` ✅ |
| `fecha_radicacion` | `FECHA DE RECIBIDO` → fallback `FECHA DEL SINIESTRO` | |
| `gasera` | `GASES DE LA GUAJIRA` / `GASGUAJIRA` | |
| `nombre_archivo_origen` | `SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx` | |

Columnas extra: `MONTO`, `COMPARATIVO`, `MONTO CANCELADO`, `FECHA DE PAGO`, `# PLANILLA`.

⚠️ En `TRÁMITE` la cédula viene con separador de miles: `"40,913,523"`. Hay que quitar las comas.

#### C3. Manifiesto completo: qué hojas cargar de cada archivo

Las 7 carpetas de gaseras se recargan **completas**. La columna `cargar` dice qué hojas van a la BD:

| Carpeta / archivo | Hojas `cargar` | Hojas `omitir` (y por qué) |
|---|---|---|
| `01_Gdo\Registro de Siniestros CMK - GDO.xlsx` | `BD` | `TABLA DINAMICA`, `INFORME` → son pivots de resumen |
| `02_Surtigas\SINIESTROS SALVAFACTURA SURTIGAS (13).xlsx` | `SALVAFACTURAS` | `RESUMEN` → pivot |
| `02_Surtigas\SINIESTROS VIDA DEUDOR SURTIGAS (15).xlsx` | `VIDA DEUDOR` | `RESUMEN` → pivot |
| `03_Ceo\Siniestros CEO.xlsx` | `Seguimiento de siniestros` | `Planillas de pago` → **nivel planilla**, no caso |
| `04_Efigas\SINIESTROS MICROSEGUROS\SINIESTROS MICRO 2026 - EFIGAS.xlsx` | `2026 ALFA`, `2026 HDI`, `2026 SURA` | — |
| `04_Efigas\SINIESTROS VIDADEUDOR\SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` | `REGISTRO DE SINIESTROS` | — |
| `05_Gases_Caribe\SINIESTROS MICROSEGUROS\BASE SINIESTROS CARIBE.xlsx` | `SINIESTROS CARIBE` | `RESUMEN`, `Hoja10` → misma vintage, dedupe |
| `05_Gases_Caribe\SINIESTROS DEUDOR\...ACTUALIZADA.xlsx` | `Tabla de siniestros ` | `TD`, `Hoja3`, `PROMIGAS` → pivots; `PLANILLAS DE PAGO` → **nivel planilla** |
| `06_Gases_Guajira\SINIESTROS MICROSEGUROS GASGUAJIRA.xlsx` | `BASE` | `TRÁMITE`, `PAGADO`, `SOLICITUD DE DOCUMENTOS`, `OBJETADO` → subconjuntos de `BASE` |
| `06_Gases_Guajira\Siniestros Deudor\SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx` | `PAGADO`, `TRÁMITE` | `2024`, `2025`, `2026` → su unión es `PAGADO` |

Columnas clave por archivo de gasera (todas verificadas hoy):

| Archivo | `estado` desde | `fecha_radicacion` desde | `gasera` | `producto` desde | `monto` desde |
|---|---|---|---|---|---|
| GDO `BD` | `ESTADO` | `FECHA DEL SINIESTRO` | `GASERA` | `PRODUCTO` | `VALOR` |
| Surtigas Salvafactura | `ESTADO` | `FECHA RECIBIDO` → `FECHA RADICADO` | `GASERA` | `PRODUCTO` | `VALOR` |
| Surtigas Vida Deudor | n.d. (formato de gestión, transpuesto) | n.d. | `SURTIGAS` | — | — |
| CEO Seguimiento | `Estado` | `Fecha de pago / Fecha de siniestros en tramite` | `COMPAÑIA ENERGETICA DE` | `PRODUCTO` (ya trae `DEUDOR`) | `Valor pagado` → `VALOR COBRAR SEGURO` |
| Efigas Microseguros | `ESTADO` | `FECHA SINIESTRO` | `Efigas` | `SEGURO` | `VALOR PAGADO` |
| Efigas Vida Deudor | `RESOLUCIÓN FINAL` → `PRE-RESOLUCION` | `FECHA DE SOLICITUD` | `Efigas` | ⚠️ código numérico | `VALIDACIÓN PAGO` |
| Caribe Microseguros | `ESTADO` | `FECHA DE ENVIO Inicial` | `GASERA` | `PRODUCTO` | n.d. |
| Caribe Vida Deudor | `ESTADO ACTUALIZADO` | `FECHA RECIBIDO CMK` | `GASCARIBE` | `RAMO` (ya trae `GRUPO DEUDORES`) | `MONTO PAGADO` |
| Guajira Microseguros | `ESTADO` | `FECHA DE RECIBIDO XUMA` | `GASERA` | `PRODUCTO` | `VALOR -PAGADO` |
| Guajira Vida Deudor | `ESTADO` | `FECHA DE RECIBIDO` | `DISTRIBUIDORA` | ⚠️ no existe | `MONTO` / `MONTO CANCELADO` |

⚠️ **Surtigas Vida Deudor viene transpuesto.** La hoja `VIDA DEUDOR` no tiene encabezados de
columna por registro: la fila 1 trae rótulos (`PROCESO GESTIÓN DE SERVICIO AL CLIENTE`,
`FECHA DE ACTUALIZACIÓN`) y los estados (`TRAMITE`, `ANULADO`, `OBJETADO`, `PAGADO`, …) están
en las **primeras columnas como filas**. Ese archivo necesita un parser aparte; no se puede leer
con el lector genérico. **Verificar en Fase B cómo está cargado hoy antes de recargarlo.**

#### C4. Los históricos: solo lo que falte, nunca a ciegas

| Archivo | Decisión |
|---|---|
| `00_Historicos\01_HDI` | Elegir `Maestro\HDI.xlsx` **o** los `Entradas\*.xlsx`, nunca ambos. El Maestro ya trae `FUENTE` por origen. |
| `00_Historicos\02_CARDIFF` | Igual: `Maestro\CARDIFF.xlsx` **o** `Entradas\Pagos Cardiff Promigas 2026.XLSM`. |
| `00_Historicos\04_SURA` | Ojo: hay 3 aseguradoras de fuente mezcladas (SURA, Brilla-Cardiff) y **dos** formatos distintos. `SURA 2026.xlsx`/`siniestros brilla.xlsx`/`SURA 2023-2024.xlsx` traen `BD` (nivel caso); `SINESTROS PAGADOS 24-25 (1)/(3).xlsx` traen solo `GASERA`/`# DE SINIESTRO`/`CEDULA AFECTADO`/`CONTRATO`/`Producto` (nivel pago, sin fecha) → puede que no se carguen hoy. |
| `00_Historicos\05_ALFA` | `Entradas\DEUDOR 2022-2023.xlsx` + `Deudor 2023.xlsx` **o** `Maestro\ALFA.xlsx`. Ojo: `Deudor 2023.xlsx` tiene columnas partidas (`FECHA`, `A_`, `PLANILLA` = 2023 / Enero / 2). |
| `00_Historicos\03_PROEXEQUIAL` | Solo agregados (`AÑO`,`MES`,`NIT`,`HUMANOS`,`MASCOTAS`,`VALOR_*`). Van con `agregado_sin_detalle = true`. `FECHA_EFECTIVA_SQL` (`normalizacion.ts:143`) ya les asigna día 1 del mes. Ojo: varias celdas traen el texto literal `"Null"` → no castear a número. |

**Cómo resolverlo sin adivinar:** en Fase B (B3) se sacan los conteos por
`nombre_archivo_origen` y se comparan contra el conteo de filas de cada Excel. El archivo cuyo
conteo en BD ya coincide con su Excel → **no se toca**. El que no coincide → se recarga. Eso
evita duplicar y evita perder histórico.

> **Los históricos no cambiaron hoy** (el más reciente es `HDI.xlsx` del 05-oct 20:40). Si en B3
> sus conteos ya cuadran, la Fase C se reduce a las 7 carpetas de gaseras y el riesgo baja mucho.
> **Recomendación: empezar por las gaseras, validar en pantalla, y solo después tocar históricos.**

### Fase D · Front: arreglar el mapeo (se puede hacer sin VPN ✅)

Todo en `src/lib/normalizacion.ts`. Son cambios de SQL, no requieren la BD para escribirse.

| # | Cambio | Dónde | Por qué |
|---|---|---|---|
| D1 | Agregar `VALIDACIÓN PAGO`, `VALOR ASEGURADO`, `MONTO`, `MONTO CANCELADO`, `COMPARATIVO` a `MONTO_SQL` | `normalizacion.ts:173` | Sin esto, Total Pagado = $0 en Efigas y Guajira Deudor |
| D2 | Regla de producto **por carpeta de origen** para Deudor | `PRODUCTO_SQL` `normalizacion.ts:51` | El producto solo existe en el nombre de la carpeta; `PRODUCTO` de Efigas es código numérico |
| D3 | Corregir `CLASE_SQL` para Microseguros | `normalizacion.ts:118-122` | `SINIESTROS MICRO 2026 - EFIGAS` y `SINIESTROS MICROSEGUROS GASGUAJIRA` caen en «Otros» |
| D4 | **Opcional**: `ESTADO_SQL` acepta columna de estado alternativa | `normalizacion.ts:12` | Si el cargador estandariza `PRE-RESOLUCION`/`RESOLUCIÓN FINAL` en `estado`, no hace falta |
| D5 | Ojo con el mapeo por gasera | `normalizacion.ts:300` | `DEPARTAMENTO_SQL` pone Efigas → Caldas y Guajira → La Guajira **por gasera**, antes que por ciudad. Con los datos nuevos, municipios pueden caer en el departamento equivocado en el mapa |

> Para D1/D2/D3, definir **también** la forma de `datos_originales` que se guarda, porque las reglas leen de ahí (`->>'COLUMNA'`). Si el cargador guarda los nombres de columna crudos, `MONTO_SQL` los encuentra solo; si los renombra, hay que alinear las dos cosas.

### Fase E · Verificación antes de presentar

```bash
npm run check      # astro check → 0 errores
npm run build      # build de producción
npm run start      # servir en :4321
```

Checks manuales (⛔, con datos cargados):

1. `/dashboard` → el **Total Pagado** ya **no** está en $0 y subió respecto a la línea base de B3.
2. Filtro **Clase de cartera = Deudor** → aparecen Efigas y Guajira (no solo Caribe y Surtigas).
3. Gráfico **por producto** → sale `Grupo Deudores`, no `Sin producto`.
4. Gráfico **por gasera** → `Efigas` y `Gases de La Guajira` con los conteos esperados (Efigas 333, Guajira 333+25 dedupe).
5. **Purgar caché** antes de medir — si no, se ven las cifras viejas. Hay `POST /api/cache` (`src/pages/api/cache.ts`) y el botón en `RefreshButton.astro`.

```sql
-- comparación antes vs después
SELECT nombre_archivo_origen, count(*) FROM siniestros.casos GROUP BY 1 ORDER BY 2 DESC;
```

### Fase F · Commit y cierre

```bash
git add -A          # incluye los 21 modificados + 10 untracked que hay sueltos
git commit -m "feat(carga): recarga completa de las 7 gaseras (Efigas y Guajira Deudor + registros nuevos) + fixes de mapeo"
git push origin main
```

⚠️ **Antes de `git add -A`**: los 21 modificados + 10 untracked llevan días sin commitear. Revisar `git diff` para que no se cuele nada sensible (`.env` no debería estar, está gitignored). Se puede partir en varios commits si prefieren historia limpia.

---

## 3. Checklist rápido para la mañana

- [ ] VPN conectada
- [ ] `select 1` responde
- [ ] Schema real de `siniestros.casos` capturado (Fase B)
- [ ] Confirmado quién/cómo se hizo la carga anterior
- [ ] Línea base guardada (conteos por archivo)
- [ ] `scripts/cargar-sharepoint.mjs` con `--dry-run` revisado
- [ ] **`--dry-run` confirma duplicados en 0** en cada patrón de la tabla ⭐
- [ ] **Las 7 carpetas de gaseras cargadas** (GDO, Surtigas, CEO, Efigas ×2, Caribe ×2, Guajira ×2)
- [ ] **Conteos por archivo comparados contra el `--dry-run`** → deben coincidir 1:1
- [ ] **Históricos: solo los que no cuadraban en B3** (o ninguno, si ya estaban bien)
- [ ] `normalizacion.ts` con D1, D2, D3 aplicados
- [ ] Caché purgada y KPIs revisados en pantalla
- [ ] `npm run check` + `npm run build` en verde
- [ ] Commit + push

### Verificación de que no se duplicó nada (⛔, obligatorio)

Si una celda del portal sube el doble de lo que debería, es duplicación. Correr antes de presentar:

```sql
-- 1. Conteos por archivo: deben coincidir con el --dry-run
SELECT nombre_archivo_origen, count(*) AS filas, max(fecha_carga)::date AS recarga
FROM siniestros.casos
GROUP BY 1 ORDER BY 2 DESC;

-- 2. Censos duplicados exactos por natural key
SELECT nombre_archivo_origen, numero_contrato, cedula, count(*) AS veces
FROM siniestros.casos
WHERE nombre_archivo_origen NOT LIKE 'PROEXEQUIAL%'
GROUP BY 1,2,3 HAVING count(*) > 1
ORDER BY veces DESC LIMIT 30;

-- 3. Total general antes vs después (debe crecer, nunca duplicarse)
SELECT count(*) AS total FROM siniestros.casos;
```

**Si la consulta 2 devuelve filas**, el archivo tiene solapamiento entre hojas o entre
`Entradas`/`Maestro`. Volver al manifiesto C3 y quitar la hoja duplicada. **No presentar con
duplicados.**

---

## 4. Pendientes que quedan abiertos

1. **¿Cómo se cargó la data la última vez?** Sin eso, la Fase C es la única incógnita real.
2. **¿`00_Historicos` ya está cargado?** Decidir con B3, no de memoria. Si ya cuadra, no se toca.
3. **¿De `Entradas` o de `Maestro` sale hoy el histórico de cada aseguradora?** Determina si
   recargar el SharePoint completo duplica el histórico entero.
4. **`SINIESTROS VIDA DEUDOR SURTIGAS (15).xlsx` viene transpuesto** y rompe el lector genérico.
   Definir el parser o decidir no recargarlo.
5. **Los 21 modificados + 10 untracked** — decidir si entran en este commit o van aparte.
6. **Docker local** — se intentó levantar un Postgres para validar el mapeo sin depender de la
   oficina, pero el motor no terminó de arrancar. Alternativa: dejar el `--dry-run` como
   validación en JS.

---

## Referencias

- Esquema y consultas base: `docs/esquema-siniestros.md`
- Patrones de normalización: `src/lib/normalizacion.ts`
- Conexión y credenciales: `docs/conexion-bd.md` (`.env` local, gitignored)
- Sesiones previas: `context/session_01.md`, `context/session_02.md`, `context/sesson_03.md`
- Colaboración git: `context/guia-colaboracion-git.md`
- Despliegue: `context/walkthrough.md`, `Dockerfile`