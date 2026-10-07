# Handoff — Carga Vida Deudor (Efigas + Guajira)

> Para: la persona con permisos de escritura en `DataCenter_Vanti` · esquema `siniestros`.
> Fecha: 2026-10-07 · Portal: http://localhost:4321
> Detalle completo del diagnóstico: `context/planes/01_Actualizacion.md`

---

## Qué hay que hacer

**Un solo archivo, un solo paso:**

```
logs\carga-deudor.sql
```

Ábrelo en DBeaver con un usuario que tenga `INSERT`/`UPDATE` en el esquema `siniestros` y
ejecútalo completo (tiene `BEGIN;` … `COMMIT;`).

| | |
|---|---|
| Filas a insertar | **687** (330 Efigas + 357 Guajira) |
| Tamaño | 907 líneas |
| `INSERT` de casos | 8 bloques (lotes de 100) |
| Baja lógica | 0 filas (los 2 archivos son nuevos, no hay nada que dar de baja) |
| Validación previa | ✅ 8/8 bloques ejecutados como `SELECT` — sintaxis y tipos OK |
| Reejecutable | ✅ sí, es idempotente |

---

## Por qué no lo corrió la aplicación

El usuario `samuel_mena` (el de la app) tiene **solo lectura** sobre las 5 tablas del esquema:

| tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `casos` | ✅ | ❌ | ❌ | ❌ |
| `cargas` | ✅ | ❌ | ❌ | ❌ |
| `aseguradoras` | ✅ | ❌ | ❌ | ❌ |
| `casos_historial` | ✅ | ❌ | ❌ | ❌ |
| `log_accesos` | ✅ | ❌ | ❌ | ❌ |

## Qué escriben exactamente

Solo filas nuevas en `siniestros.casos` (17 columnas, las que ya usa el ETL) y una fila de
bitácora en `siniestros.cargas` por archivo. **No se toca ninguna fila existente.**

Los 687 registros se reparten así:

| Archivo | `nombre_archivo_origen` | Filas | `id_aseguradora` | Gasera |
|---|---|---|---|---|
| `04_Efigas\SINIESTROS VIDADEUDOR\SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` | `SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` | 330 | **5** (Seguros Alfa) | `EFIGAS` |
| `06_Gases_Guajira\Siniestros Deudor\SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx` | `SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx` | 357 | **4** (Seguros SURA) | `GASGUAJIRA` |

**Sobre la aseguradora:** ninguno de los dos archivos trae columna `ASEGURADORA`. Se atribuyó
cruzando cédulas y nombres contra lo ya cargado (mismo método que ya usó el ETL previo, documentado
en `notas_etl` de los archivos Deudor del Caribe y Surtigas). Si tuエリア lo conoce distinto,
se cambia en `scripts/cargar-sharepoint.mjs` (campo `id_aseguradora` del manifiesto) y se regenera
el SQL. **Confirma estos 2 valores antes de correr.**

## Conventions que respeta el script

- **Nunca `DELETE`.** Las bajas son lógicas: `vigente = false` + copia en `casos_historial`.
- **Idempotente.** Cada `INSERT` lleva `WHERE NOT EXISTS` sobre `clave_natural`, así que correrlo
  dos veces no duplica nada.
- **`datos_originales`** guarda la fila cruda del Excel, con los nombres de columna originales.
  Las reglas de `src/lib/normalizacion.ts` dependen de esos nombres exactos (`VALIDACIÓN PAGO`,
  `MONTO`, `RAMO`…). Si se renombran, el portal deja de calcular bien.
- `SET client_encoding = 'UTF8'` va al inicio: los nombres tienen tilde.

---

## Después de correr — Verificación (OBLIGATORIA)

El archivo ya trae estas consultas al final. Corrélas y mandame la salida.

### 1. Los dos archivos deben aparecer con sus conteos

```sql
SELECT nombre_archivo_origen,
       count(*) FILTER (WHERE vigente) AS vigentes,
       count(DISTINCT clave_natural) AS claves_distintas
FROM siniestros.casos
WHERE nombre_archivo_origen ILIKE '%VIDADEUDOR%'
   OR nombre_archivo_origen ILIKE '%VIDA DEUDOR GASGUAJIRA%'
GROUP BY 1;
```

Esperado: `SINIESTROS VIDADEUDOR 2026 - EFIGAS.xlsx` → 330 y
`SINIESTROS VIDA DEUDOR GASGUAJIRA.xlsx` → 357, con `vigentes = claves_distintas`.

### 2. Esta consulta DEBE SALIR VACÍA

```sql
SELECT nombre_archivo_origen, clave_natural, count(*) AS veces
FROM siniestros.casos
WHERE vigente AND clave_natural IS NOT NULL
GROUP BY 1,2 HAVING count(*) > 1;
```

> **Ojo — este control tiene una excepción conocida y preexistente**, que **no** es culpa de esta
> carga: hay 143 grupos donde la `clave_natural` se repite pero la **aseguradora es distinta**
> (136 con producto diferente, 54 con estado diferente, 9 con monto diferente). Son registros
> legítimamente distintos que el índice `idx_casos_clave_natural` mantiene separados porque
> incluye `id_aseguradora`. Lo que hay que confirmar es que **esta carga no añadió ninguno nuevo**:
> el conteo debe seguir en 143.

### 3. Deudor por gasera (esto es lo que se va a presentar)

```sql
SELECT gasera, estado, count(*) AS n
FROM siniestros.casos
WHERE vigente AND nombre_archivo_origen ILIKE '%DEUDOR%'
  AND nombre_archivo_origen NOT ILIKE '%planilla%'
GROUP BY 1,2 ORDER BY 1,3 DESC;
```

### 4. Volumen total (no debe moverse salvo por las 687 altas)

```sql
SELECT count(*) FILTER (WHERE vigente) AS vigentes,
       count(*) FILTER (WHERE NOT vigente) AS retiradas,
       count(*) AS total
FROM siniestros.casos;
```

Antes: **43.521** vigentes / 2.743 retiradas / 46.264 total.
Después esperado: **44.208** vigentes / 2.743 retiradas / **46.951** total.

---

## Luego en el portal

1. Purgar caché: `POST http://localhost:4321/api/cache` (o el botón de refrescar).
   **Sin esto el tablero muestra las cifras viejas.**
2. Recargar `/dashboard`.
3. Comprobar:
   - **Total Pagado 2026** sube de **$6.946.528.618** (debe crecer: entra el Deudor nuevo).
   - Filtro **Clase = Deudor** → ahora debe ofrecer **Caribe, Efigas, Guajira y Surtigas**
     (antes solo Caribe y Surtigas).
   - Producto del Deudor = **Grupo Deudores** (no *Sin producto*).
   - Filtro **Clase = Microseguros** ya no manda Efigas/Guajira a *Otros*.

---

## Archivos relacionados

| Qué | Dónde |
|---|---|
| Generador del SQL | `scripts/cargar-sharepoint.mjs` (`--dry-run`, `--apply`, `--sql`) |
| SQL a ejecutar | `logs/carga-deudor.sql` |
| Reglas de mapeo | `src/lib/normalizacion.ts` |
| Consultas del portal | `src/lib/query.ts` |
| Diagnóstico completo | `context/planes/01_Actualizacion.md` |