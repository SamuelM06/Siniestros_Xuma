# Probabilidad — Cálculos de la vista Proyección

> Fuente de verdad: `src/lib/estadistica.ts` (motor puro) + `src/lib/query.ts` (`getProyeccion`) + `src/lib/types.ts`.
> Todo lo que se ve en `/proyeccion` sale de estos cálculos; no hay IA generativa ni cajas negras.

---

## 1. Datos de entrada

### 1.1 Tabla `siniestros.casos`
- **Base**: `WITH base AS (SELECT sub.* FROM (SELECT c.*, estado_norm, gasera_norm, producto_norm, departamento_norm, municipio_norm, monto, tipo_siniestro_norm, aseguradora_norm) sub WHERE gasera_norm <> 'Promigas')` (`query.ts:18`).
- **Normalizaciones visibles**: `Cardif BNP Paribas → Cardif`, `Gases de Occidente → GDO`, `Compañía Energética → CEO`, `Promigas` excluido (`query.ts:16`, `normalizacion.ts`).
- **Monto válido**: `monto <= 10_000M` (`MONTO_MAX_VALIDO = 1e10`), se excluye de sumas (1 registro corrupto 2024).

### 1.2 Ventana de entrenamiento
- `ANIO_HIST_MIN = 2018`, `ANIO_ENTRENA_MAX = 2025`, `ANIO_OBJETIVO = 2027` (`query.ts:44,808`).
- `filas: MesEntrenamiento[]` = 96 filas (8 años × 12 meses) con `total` (siniestros) y `valor` (suma `monto` pagado) por `(anio, mes)` (`query.ts:835`).
- `2026` parcial **excluido** del entrenamiento para no contaminar estacionalidad (`query.ts:803`).
- Filtros `gasera / producto / aseguradora` se aplican en `WHERE gasera_norm = $n` etc.; `desde/hasta/mes/estado/tipo` **no** afectan a proyección (solo segmento).

---

## 2. Motor estadístico (`estadistica.ts`)

### 2.1 Utilidades
- `media(xs)`, `mediana(xs)`, `percentil(xs,p)` con interpolación lineal (`estadistica.ts:13,18,28`).
- `erf`, `normCDF` para Mann-Kendall (`estadistica.ts:53`).
- `wilson(n,N,z=1.96)` → `p, low, high` 95% (`estadistica.ts:91`).
- `laplace(conteos)` → `(c+1)/(N+K)` nunca cero (`estadistica.ts:101`).
- `theilSen(x,y)` mediana de pendientes pairwise (`estadistica.ts:41`), `O(n²)` pero `n=8` → trivial.
- `mannKendall(vals)` S + `p` bilateral con corrección de empates (`estadistica.ts:69`).
- `chiCuadradoP(a,b)` homogeneidad temprano vs reciente vía `gammaQ` (`estadistica.ts:176`).

### 2.2 Forecast mensual `pronosticar(filas, anioObjetivo)` (`estadistica.ts:228`)
**Método**: seasonal-naive proporcional + drift Theil-Sen.

1. **Anuales**: `anualSin[y]`, `anualVal[y]` sumando `f.total`/`f.valor` por año.
2. **Drift**: `pendSin = theilSen(anios, anuales)` , `pendVal = theilSen(anios, anualesV)` (casos/año y $/año).
3. **Total objetivo**: `totalObj = round(anuales[last] + pendSin * pasos)` donde `pasos = anioObjetivo - ultimoAnio` (`estadistica.ts:252`). Para `2027` → `pasos=2`, para `2026` → `pasos=1`.
4. **Reparto estacional**: `shareS[m] = mesSin[m]/granSin`, `shareV[m] = mesVal[m]/granVal` (participación histórica del mes).
5. **Puntual**: `s = round(totalObj * shareS[m])`, `v = round(valorObj * shareV[m])`.
6. **Bandas 80% pooled**: residuos relativos `r = f.total/esperado -1` para cada `(anio,mes)`; `bLow = 1+percentil(r,0.1)`, `bHigh = 1+percentil(r,0.9)` (`estadistica.ts:267`). `sinLow = round(s*bLow)`, `sinHigh = round(s*bHigh)` idem monto.

### 2.3 Índices estacionales `indicesEstacionales(filas)` (`estadistica.ts:301`)
`indice[m] = media( mes/anual*12 )` por año. `1 = mes promedio`, `1.4 = 40% sobre promedio`. Bandas `low/high = p10/p90` entre años.

### 2.4 Distribuciones `distribucion(conteos)` (`estadistica.ts:334`)
`conteos: {nombre, casos}[]` → `prob = (casos+1)/(N+K)` (Laplace) + `low/high` Wilson 95%, ordenado por `prob` desc. Top 8 se muestra.

### 2.5 Backtest `backtest(filas, [2024,2025])` (`estadistica.ts:366`)
Walk-forward: entrena con `anio < t`, predice `t`, compara real vs pron. `MAPE mensual = mean(|r-p|/r)` y `errAnualPct`. `mape = media(mapes)`.

---

## 3. Ensamblaje `getProyeccion` (`query.ts:812`)

### 3.1 Consultas (1 ronda paralela, 5 queries)
- `mensual` (96 filas), `deptos` (top ∞), `tipos`, `tiposPeriodo` (temprano 2018-2022 vs reciente 2023-2025), `deptosPeriodo`.
- `where = fecha 2018-2025 AND gasera/producto/aseguradora` + `corte = CASE YEAR <=2022 THEN temprano ELSE reciente`.

### 3.2 Cálculos derivados
- `aniosEntrenamiento = [2018..2025]`.
- `pron = pronosticar(filas,2027)` → `forecast[12]` (`PuntoForecast`).
- `anuales = [∑mes por año]` → `pendiente = theilSen(anios, anuales)` → `pendienteAnual`, `mk = mannKendall(anuales)`, `direccion` (alza/baja/estable), `crecimientoVsPrevio = (totalProy - previo)/previo` (`query.ts:888`).
- `mapaRealPrevio` de `2025` → `refAnioPrevio` por mes.
- `estacionalidad` vía `indicesEstacionales`.
- `departamentos/tiposSiniestro` vía `distribucion(...).slice(0,8)` (`query.ts:932`).
- `chiCuadradoP` para `cambios` (tipo y depto) + `backtest` + `supuestos` (6 frases).

### 3.3 Cierre 2026 Oct–Dic (añadido en esta sesión)
```ts
const pron2026 = pronosticar(filas, 2026); // pasos=1
const forecast2026 = pron2026.filter(p=>p.mes>=10).map(...) // 3 puntos
```
Mismo `refAnioPrevio` de 2025 para comparar. Se expone como `forecast2026: PuntoForecast[3]` (`types.ts:231`, `query.ts:935`). Ejemplo real (sin filtro, 8 años):

| Mes | siniestros | sinLow | sinHigh | monto | montoLow | montoHigh | ref 2025 |
|-----|-----------|--------|---------|-------|----------|-----------|----------|
| Oct | 900 | 579 | 1226 | 2_439_362_520 | 0 | 4_319_730_704 | 750 |
| Nov | 840 | 540 | 1144 | 2_152_744_186 | 0 | 3_812_174_321 | 782 |
| Dic | 676 | 435 | 921 | 1_231_856_149 | 0 | 2_181_425_182 | 432 |

> Nota: `montoLow 0` sale cuando `bValLow` es negativo (p10 muy bajo); se clampdea a 0.

---

## 4. Qué se ve en `/proyeccion` y de dónde sale

### KPIs (4)
- **Siniestros 2027**: `tendencia.totalProyAnual = Σ forecast.siniestros` (12 meses).
- **Pagado proyectado**: `tendencia.montoProyAnual = Σ forecast.monto`.
- **Depto con mayor riesgo**: `departamentos[0]` (max `prob` Laplace). Ej: `Ceo 31ms` en API cache.
- **Mes pico proyectado**: `max(forecast, s=>siniestros)` → `label` + `siniestros` + rango.

### Gráficos
- **Pronóstico 2027** (`ForecastChart`): `ComposedChart` con `Bar sin` (color por mes `COLORES_MES[12]`, `barSize 36`) + `Line referencia` (2025) + `Line monto` (COP). Ejes `13/12 bold`.
- **Probabilidad por departamento / tipo**: listas `ProbItem` con barra `prob*200%` + `casos`.
- **Índice estacional** (antes full-width, hoy eliminado para single-view; lógica sigue en API) + **Cierre 2026 Oct–Dic** (`compact` 190px, mismos 3 colores Oct-Dic).

### Filtros
- Solo `gasera / aseguradora / producto` (`FiltrosPanel modoProyeccion`). Cada cambio recalcula `getProyeccion` con `WHERE` respectivo; el motor se re-ejecuta con 96 filas filtradas.

---

## 5. Ejemplo numérico paso a paso (sin filtro)

1. **Anuales 2018-2025**: supongamos `anuales = [7200,7350,7100,7500,7700,8000,8200,8500]`.
2. **Theil-Sen**: pendientes ` (7350-7200)/1=150, ...` mediana ≈ `~180 casos/año` → `pendienteAnual 180`.
3. **2027**: `totalObj = 8500 + 180*2 = 8860`.
4. **Gran total** `granSin = 61450`, `mesSin[10]=5000` → `share Oct = 0.081` → `Oct 2027 ≈ 8860*0.081≈718`.
5. **Residuos**: si `p10=-0.35, p90=+0.35` → `Oct low 466 high 969`.
6. **2026 Oct**: `totalObj2026 = 8500+180=8680` → `Oct 2026 ≈ 8680*0.081≈703` pero con datos reales el modelo da `900` (por estacionalidad exacta de la BD, no del ejemplo).

Los números reales de la tabla de arriba salen de la BD `DataCenter_Vanti` (41k filas) y no de este ejemplo sintético.

---

## 6. Limitaciones y supuestos (los 6 que ve el usuario)

1. Entrenamiento 8 años cerrados (2018-2025), 2026 excluido.
2. Drift Theil-Sen lineal (robusto a outliers, no a quiebres).
3. Bandas p10/p90 pooled (asume homocedasticidad relativa).
4. Laplace + Wilson para categorías (suaviza ceros).
5. Montos >10_000M excluidos, Promigas excluido.
6. MAPE walk-forward 2024-2025.

Cambios estructurales con `p<0.05` en chi-cuadrado avisan si la mezcla de tipos/deptos cambió entre 2018-2022 vs 2023-2025.

---

## 7. Archivos y pruebas

- Tests del motor: `src/lib/estadistica.test.ts` (si existe) o validar con `npx vitest`/`npm run check`.
- API: `GET /api/proyeccion?gasera=Ceo` → `forecast`, `forecast2026`, `tendencia`, `departamentos`...
- Caché: `conCache` 15min fresco / 2h stale + precarga de 10 segmentos en `precalentarCache` (`query.ts:1110`).
- Cliente: `ProyeccionApp` debounce 280ms + cache LRU 30.

---

## 8. Cómo reproducir los números de Oct/Nov/Dic 2026

```bash
curl http://127.0.0.1:4321/api/proyeccion | jq '.forecast2026'
# o con filtro
curl "http://127.0.0.1:4321/api/proyeccion?gasera=Ceo" | jq '.forecast2026'
```

Cada `gasera/aseguradora/producto` da un `forecast2026` distinto porque `filas` se filtra antes de `pronosticar`.

