# Esquema `siniestros` — Documentación

> Vista verificada contra la BD en fase de planificación. No contiene datos sensibles:
> solo estructura, tipos y conteos; los ejemplos de nombres no son reales.

## Tablas

### `siniestros.casos` — Registros de siniestros (tabla principal)

~28.882 registros. Un registro = un caso / siniestro.

| Columna                 | Tipo      | Null | Descripción                              | Uso dashboard |
|-------------------------|-----------|------|------------------------------------------|---------------|
| `id_caso`               | int       | NO   | Clave primaria                           | — |
| `id_aseguradora`        | int       | NO   | FK → `aseguradoras.id_aseguradora`       | gráfico por aseguradora |
| `nombre_asegurado`      | varchar   | SÍ   | Nombre del asegurado                     | tabla detalle |
| `nombre_reclamante`     | varchar   | SÍ   | Reclamante                               | tabla detalle |
| `nombre_afectado`       | varchar   | SÍ   | Afectado                                 | tabla detalle |
| `numero_contrato`       | varchar   | SÍ   | Contrato vinculado                       | **filtro input** |
| `cedula`                | varchar   | SÍ   | Documento                                | tabla detalle |
| `estado`                | varchar   | SÍ   | Estado del siniestro (sin normalizar)    | KPI + badges |
| `fecha_radicacion`      | date      | SÍ   | Fecha de radicación                      | rango fechas + tendencia |
| `observacion`           | text      | SÍ   | Notas                                    | tooltip |
| `correo_agente`         | varchar   | SÍ   | Agente responsable                       | tabla detalle |
| `proveedor`             | varchar   | SÍ   | Aseguradora en texto (coincide con `aseguradoras.nombre`) | gráfico aseguradora |
| `gasera`                | varchar   | SÍ   | Gasera (sin normalizar, ~38 variantes)   | **filtro** + gráfico |
| `datos_originales`      | jsonb     | SÍ   | Campos crudos del archivo fuente         | producto + montos |
| `agregado_sin_detalle`  | bool      | NO   | Marca de registros sin detalle           | calidad |
| `fecha_carga`           | timestamp | SÍ   | Cuándo se cargó                          | auditoría |
| `nombre_archivo_origen` | varchar   | SÍ   | Archivo de origen                        | auditoría |
| `notas_etl`             | text      | SÍ   | Notas del proceso de carga               | auditoría |

### Parámetros observados en `estado` (variantes → categoría canónica)

Dado el rango visto (~35 valores distintos), se agrupa así:

```
Pagado                → PAGADO · Pagado-Pago Total · Pagado- Cuotas Adicionales ·
                        06 PAGADO CERRADO · En Proceso Pago · paGADO
Objetado              → Objetado · OBJETADO
Solicitud de documentos → SOLICITUD DE DOCUMENTOS · Pendiente Certificado · Pendiente llamada
Tramite / Seguimiento → TRAMITE · Tramitado · Seguimiento · Abierto · Aperturado ·
                        Reaperturado · En Suspenso - Primer envio · Por Coordinar
Concluido / Cerrado   → Concluído · CERRADO · Directo · Directo Fallecido ·
                        Directo No Fallecido · Exhumacion
Negado / Anulado      → Negado · Anulado · No fallecido · No Prestado · Retorno · Volteo
En revision           → REVISION ALFA · REVISION OPERACIONES · REVISION PARA DESMONTE
Sin estado            → NULL (~9.169)
```

### Parámetros observados en `gasera` (variantes → alias canónico)

```
Gases de Occidente (GDO) → GDO · GASES DE OCCIDENTE* · Gases De Occidente-gdo Proexequial
Gases del Caribe         → BRILLA GASES DEL CARIBE* · GASES DEL CARIBE* · Gases-caribe-proexequial
Surtigas                 → SURTIGAS* · Surtigas-proexequial
Efigas                   → EFIGAS* · Efigas-proexequial
Gases de La Guajira      → GASES DE LA GUAJIRA*
Compañía Energética de Occidente → COMPAÑÍA ENERGÉTICA* · Compañia Energetica* · CEO
Promigas                 → PROMIGAS*
```

### `siniestros.aseguradoras` — Catálogo de aseguradoras (5 filas)

`id_aseguradora`, `slug`, `nombre`, `logo_filename`.

| id | slug        | nombre              | logo_file |
|----|-------------|---------------------|-----------|
| 1  | hdi         | HDI Seguros         | hdi.png   |
| 2  | cardiff     | Cardif BNP Paribas  | cardiff.svg |
| 3  | proexequial | Proexequial         | proexequial.png |
| 4  | sura        | Seguros SURA        | sura.svg  |
| 5  | alfa        | Seguros Alfa        | alfa.svg  |

> Los `logo_filename` de aseguradoras NO existen aún en `public/logos/` del proyecto: en la
> Fase 6 se incorporan (descargados/vectorizados) o se usa el isotipo Xuma + nombre.

### `siniestros.cargas` — Bitácora de cargas (12 filas)

`id_carga`, `aseguradora`, `nombre_archivo`, `fecha_carga`, `filas_leidas`, `filas_cargadas`,
`estado`, `notas`. Útil para auditoría/cuándo se actualizó la data.

### `siniestros.log_accesos` — Auditoría de consultas (7/24)

`id_log`, `usuario_nombre`, `rol`, `cedula`, `numero_contrato`, `resultado`, `total_resultados`,
`ip_origen`, `fecha_consulta`. Registra consultas de contratos (aplicación existente).

## Extracción de producto y montos (JSONB `datos_originales`)

```sql
-- Producto (ej. ramo), con fallback a otros keys según aseguradora
COALESCE(
  datos_originales->>'Ramo_Desc',
  datos_originales->>'DESC_RAMO_PROD',
  datos_originales->>'Ramoproducto',
  'Sin producto'
) AS producto

-- Valor pagado (para KPI Total Pagado)
NULLIF(datos_originales->>'VALOR PAGOS', '')::numeric AS valor_pagado

-- Valor incurrido
datos_originales->>'VALOR INCURRIDO'
```

> Otras keys útiles: `VALOR RESERVA`, `SALDOPENDIENTE`, `ESTADO SINIESTRO`, `REGIONAL`,
> `FECHA OCURRENCIA`, `NOMBRE_DEL_ASEGURADO`, `COMPANIA`.

## Rango temporal observado

- `fecha_radicacion`: desde 1981 hasta ago-2026. El reporte usa **año 2026** como filtro base.
- `fecha_carga`: la última carga se hizo en sep-2026 (los datos están al día).

## Consultas de KPI (patrón base)

```sql
-- Total 2026
SELECT count(*)::int AS total
FROM siniestros.casos
WHERE fecha_radicacion BETWEEN $1 AND $2
  AND ($3::text IS NULL OR numero_contrato ILIKE '%'||$3||'%')
  AND ($4::text IS NULL OR gasera_canonica = $4);   -- gasera_canonica vía CASE/alias
```