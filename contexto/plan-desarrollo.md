# Plan de Desarrollo — Dashboard de Siniestros Xuma 2026

> Documento vivo: cada fase se marca como `[x]` cuando se complete.
> Versión: 1.0 · Fecha: 17-sep-2026 · Plantilla base verificada contra la BD real.

---

## 1. Stack tecnológico (decidido)

| Capa        | Tecnología                                    | Por qué |
|-------------|-----------------------------------------------|---------|
| Framework   | **Astro 5** (islas/SSR)                        | HTML puro por defecto, ligero, permite UI islands de interactividad |
| Interactividad | **React 18** (como islas de Astro)          | Gráficos, filtros, tabla, contadores |
| Gráficos    | **Recharts**                                  | Animaciones fluidas nativas (bars, lines, donut) |
| Animaciones | **Framer Motion** (UI) + CSS keyframes (fondos)| Tipos de entrada, conteos, parallax, orbes *blur* |
| Estilos     | **Tailwind CSS v4** + tokens de marca          | Paleta y tipografía Xuma como variables |
| Tipografía  | **@fontsource/raleway** (Regular/Medium/Bold) | Raleway = tipografía corporativa; empaquetada, sin CDN |
| Backend     | **Astro API Endpoints** (`src/pages/api/`) + **node-postgres (`pg`)** | Nunca se consulta la BD desde el navegador |
| Env         | **dotenv** (+ `astro:env` para tipar)          | Variables seguras, `.env` gitignored |
| HTTP cliente| `fetch` nativo (server/extremidades de Astro)   | Sin dependencias extra |

**Decisiones clave**
- Backend y frontend **en el mismo repo** (single deploy): Astro sirve las rutas. No habrá CORS.
- **SSR** (`output: 'server'`) para que los KPIs/gráficos se carguen con datos frescos y los
  filtros hagan refetch por API.
- Fondo animado y animaciones **siempre usuarios** (respetar `prefers-reduced-motion`).

## 2. Seguridad — regla de oro

- `.env` con credenciales reales → **gitignored** (ya creado localmente).
- `.env.example` con placeholders → sí se sube.
- Endpoints leen credenciales solo de `process.env`.
- No se incluyen IPs internas, contraseñas ni contratos reales en README/docs/commits.
- La contraseña compartida en el chat debe **rotarse** tras el desarrollo.

> ⚠️ RECORDATORIO: revisar `git log` y los archivos antes de cada push.

## 3. Estructura del proyecto (ya creada)

```
Siniestros_Xuma/
├── .env                    # credenciales reales (NO se sube)
├── .env.example            # plantilla pública
├── .gitignore
├── README.md
├── contexto/
│   ├── idea-proyecto.md
│   └── plan-desarrollo.md
├── docs/
│   ├── conexion-bd.md
│   ├── esquema-siniestros.md
│   ├── manual-marca.md
│   └── manual-marca-fuente.md   # copia del Manual de Marca original
├── public/
│   ├── logos/              # logos Xuma (svg + png)
│   └── fonts/              # (reservado; Raleway va por @fontsource)
└── src/
    ├── layouts/
    │   ├── MainLayout.astro
    │   └── DashboardLayout.astro
    ├── pages/
    │   ├── index.astro         # bienvenida / contexto
    │   ├── dashboard.astro     # tablero principal
    │   └── api/
    │       ├── kpis.ts
    │       ├── por-aseguradora.ts
    │       ├── por-gasera.ts
    │       ├── tendencia.ts
    │       ├── por-producto.ts
    │       ├── tabla.ts
    │       └── metadatos.ts    # listas de gaseras/productos/fechas para filtros
    ├── components/
    │   ├── kpi/KpiCard.tsx
    │   ├── charts/TendenciaLineChart.tsx
    │   ├── charts/DonutChart.tsx
    │   ├── charts/BarChartAseguradora.tsx
    │   ├── charts/BarChartGasera.tsx
    │   ├── filtros/FiltrosPanel.tsx
    │   ├── tabla/TablaSiniestros.tsx
    │   └── ui/AnimatedBackground.tsx
    ├── lib/
    │   ├── db.ts            # pool pg
    │   ├── query.ts         # consultas reutilizables + normalización
    │   └── normalizacion.ts # diccionarios estado/gasera
    ├── styles/global.css    # tokens de marca (Tailwind @theme)
    └── utils/formatters.ts  # COP, fechas, n° con miles
```

## 4. Modelo de datos real (verificado contra la BD)

### Tabla principal `siniestros.casos` (28.882 registros)

| Columna                | Tipo  | Uso en el dashboard |
|------------------------|-------|---------------------|
| `id_caso`              | int   | PK |
| `id_aseguradora`       | int   | FK → `aseguradoras` |
| `nombre_asegurado` / `nombre_reclamante` / `nombre_afectado` | varchar | Detalle tabla |
| `numero_contrato`      | varchar | Filtro por contrato (texto) |
| `cedula`               | varchar | Detalle |
| `estado`               | varchar | KPIs + color de badge (normalizar) |
| `fecha_radicacion`     | date   | Filtro rango de fecha + tendencia mensual |
| `observacion`          | text   | Detalle (tooltip) |
| `correo_agente`        | varchar | Detalle |
| `proveedor`            | varchar | Aseguradora (texto, coincide con `aseguradoras.nombre`) |
| `gasera`               | varchar | Filtro gasera + gráfico por gasera (normalizar) |
| `datos_originales`     | jsonb  | **Producto** (`Ramo_Desc`) y **Valores** (`VALOR PAGOS`) |
| `agregado_sin_detalle` | bool   | Control de calidad |
| `fecha_carga`          | timestamp | Auditoría |
| `nombre_archivo_origen`| varchar | Auditoría |

### `siniestros.aseguradoras` (5 filas)

`id_aseguradora`, `slug`, `nombre`, `logo_filename`. Nombres: HDI Seguros, Cardif BNP Paribas,
Proexequial, Seguros SURA, Seguros Alfa. → Se usan en gráficos por aseguradora (join) y logos.

### Clave para "Total Pagado" y "Producto" (JSONB `datos_originales`)

Keys relevantes detectadas en los archivos fuente:
- Producto: `Ramo_Desc`, `DESC_RAMO_PROD`, `Ramoproducto`, `Amparo_Desc`.
- Montos: `VALOR PAGOS`, `VALOR INCURRIDO`, `VALOR RESERVA`, `SALDOPENDIENTE`.
- Estados fuente: `ESTADO SINIESTRO`.
- Extra: `REGIONAL`, `FECHA OCURRENCIA`, `NOMBRE_DEL_ASEGURADO`.

> Extracción: `(datos_originales->>'VALOR PAGOS')::numeric` con validación de cast y conteo de
> nulos (se documentará en `docs/esquema-siniestros.md`).

### Normalización necesaria (crucial)

**Estados → categoría canónica** para KPIs y badges:

| Categoría       | Estados que la conforman (vistos en la BD) |
|-----------------|---------------------------------------------|
| `Pagado`        | PAGADO, Pagado-Pago Total, Pagado- Cuotas Adicionales, 06 PAGADO CERRADO, En Proceso Pago, paGADO |
| `Objetado`      | Objetado, OBJETADO |
| `Solicitud de documentos` | SOLICITUD DE DOCUMENTOS, Pendiente Certificado, Pendiente llamada (revisar) |
| `Tramite / Seguimiento` | TRAMITE, Tramitado, Seguimiento, Abierto, Aperturado, Reaperturado, En Suspenso - Primer envio, Por Coordinar |
| `Concluido / Cerrado` | Concluído, CERRADO, Directo, Directo Fallecido, Directo No Fallecido, Exhumacion |
| `Negado / Anulado` | Negado, Anulado, No fallecido, No Prestado, Retorno, Volteo |
| `En revision`   | REVISION ALFA, REVISION OPERACIONES, REVISION PARA DESMONTE |
| `Sin estado`    | NULL (9.169 registros) |

**Gaseras → alias canónico** (normalizar ~38 variantes). Estrategia: tabla de mapeo en
`src/lib/normalizacion.ts` + columna derivada en consulta (`CASE`), ej.:
`GDO`, `GASES DE OCCIDENTE*`, `Gases De Occidente-gdo Proexequial` → **Gases de Occidente (GDO)**;
`BRILLA GASES DEL CARIBE*`, `GASES DEL CARIBE*`, `Gases-caribe-proexequial` → **Gases del Caribe**;
`SURTIGAS*`, `Surtigas-proexequial` → **Surtigas**;
`EFIGAS*`, `Efigas-proexequial` → **Efigas**;
`GASES DE LA GUAJIRA*` → **Gases de La Guajira**;
`COMPAÑIA ENERGETICA*` → **Compañía Energética de Occidente**;
`PROMIGAS*` → **Promigas**.

> Como mejora Fase 9: persistir alias en tabla `dimensiones` y evitar CASE repetido.

## 5. Fases de desarrollo

### Fase 0 — Inicialización  `[in_progress]`
- [x] Crear estructura de carpetas.
- [x] Copiar logos Xuma a `public/logos/`.
- [x] Crear `.gitignore`, `.env` (real) y `.env.example` (ficticio).
- [x] Redactar `contexto/idea-proyecto.md` y `contexto/plan-desarrollo.md`.
- [x] Explorar esquema real de la BD (este plan ya refleja los datos).
- [ ] `npm create astro@latest .` (template minimal, TS, SSR).
- [ ] Instalar deps: `react react-dom @astrojs/react recharts framer-motion tailwindcss @fontsource/raleway pg dotenv`.
- [ ] Configurar `astro.config.mjs` (output server, react, tailwind), `tsconfig`.
- [ ] `git init` + `git remote add origin https://github.com/SamuelM06/Siniestros_Xuma.git`.

### Fase 1 — Conexión a datos y API base
- [ ] `src/lib/db.ts`: `Pool` de `pg` leyendo credenciales de `process.env` (con `gin-variables`,
      SSL si `DB_SSL=true`, timeout, `max` de conexiones).
- [ ] `src/lib/query.ts`: filtros tipados (`{ contrato?, fechaDesde?, fechaHasta?, gasera?, producto?, anio=2026 }`).
- [ ] `src/lib/normalizacion.ts`: diccionarios de estados y gaseras + función `tryToNum(v)`.
- [ ] Endpoint `api/metadatos.ts`: gaseras canónicas, productos, rango de fechas (para poblar fichas).
- [ ] Prueba: `npm run dev` y verificar que todos los endpoints respondan SIN credenciales en la UI.

### Fase 2 — KPIs
- [ ] `api/kpis.ts`: devuelve →
      total_siniestros, pagados, objetados, solicitud_documentos, total_pagado (COP),
      + % variación contra 2025 para dar contexto.
- [ ] SQL: `count(*)` con filtros + `sum((datos_originales->>'VALOR PAGOS')::numeric)` para pagados.
- [ ] `KpiCard.tsx`: animación **count-up** (Framer Motion `useSpring`/`animate`), icono/emoji,
      badge estado, *glassmorphism* (blur) con acentos de marca.

### Fase 3 — Gráficos (todos animados)
- [ ] `api/por-aseguradora.ts`: `count` por mes × aseguradora (join a `aseguradoras`), agrupado 2026.
- [ ] `api/por-gasera.ts`: `count` agrupado por gasera canónica.
- [ ] `api/tendencia.ts`: `count` y `sum(valor pagado)` por mes (para línea + área).
- [ ] `api/por-producto.ts`: `count` por `Ramo_Desc` (JSONB) → dona/pie de porciones.
- [ ] Componentes Recharts con animación: crecimiento de barras, dibujo progresivo de línea,
      `AnimationDuration` + Framer Motion en contenedores.
- [ ] Paleta Recharts = tokens Xuma (`#120180`, `#5AE280`, `#00CD93`, `#333333`).
- [ ] *Grid* responsivo: KPIs 1→4 cols, gráficos 1→2 cols, tabla full width.

### Fase 4 — Filtros
- [ ] `FiltrosPanel.tsx` (React island): input contrato (**debounce 400ms**), rango de fechas
      (nativo + pickers), select gasera (con búsqueda), select producto.
- [ ] Los filtros disparan **refetch** a todos los endpoints (solo los activos cambian payload).
- [ ] URL state (`?contrato=...&desde=...`) para compartir/reponer.
- [ ] Anime la aparición de resultados (transiciones `AnimatePresence`).

### Fase 5 — Tabla de detalle
- [ ] `api/tabla.ts`: paginación (page/pageSize), orden por fecha, respeta filtros,
      devuelve total de registros para los controles.
- [ ] `TablaSiniestros.tsx`: columnas (contrato, asegurado, aseguradora, gasera, producto,
      estado→badge animado, fecha radicación, valor pagado COP), **paginación** y skeleton
      shimmer al cargar.
- [ ] Descargable a CSV (cliente) si es necesario.

### Fase 6 — Diseño e identidad visual
- [ ] `styles/global.css`: Tailwind `@theme` con tokens Xuma (azul/verdes/gris), fuente Raleway.
- [ ] `AnimatedBackground.tsx`: orbes de gradiente animados con `filter: blur()`, leve parallax,
      respeta `prefers-reduced-motion`.
- [ ] Header/Sidebar con **logo Xuma**, título del reporte y menú (Inicio / Dashboard).
- [ ] Responsive: sidebar colapsa a drawer en móvil; grid adaptativo en todos los breakpoints.
- [ ] Micro-animaciones: hover en tarjetas/gaficas, skeleton loading, transición entre sesiones.

### Fase 7 — Sesión de bienvenida
- [ ] `index.astro`: hero con contexto del reporte 2026, tarjetas de "qué encontrarás"
      (KPIs, tendencias, porciones, detalle), botón animado → `/dashboard`.
- [ ] Animación de entrada escalonada (Framer Motion), fondo con orbes.

### Fase 8 — Documentación y entrega
- [ ] `docs/conexion-bd.md`, `docs/esquema-siniestros.md`, `docs/manual-marca.md` completos.
- [ ] `README.md`: qué es, requisitos, `cp .env.example .env`, `npm install && npm run dev`,
      stack, estructura, seguridad.
- [ ] Revisión de seguridad (sin secretos en `git log`, sin IPs reales en archivos públicos).
- [ ] Build de producción (`npm run build`) y prueba local.

### Fase 9 — Mejoras (post-entregable)
- [ ] Tabla `dimensiones` para alias de gaseras/productos gestionados desde BD.
- [ ] Caché in-process de respuesta de KPIs (±60 s) para no saturar la BD.
- [ ] Exportación a Excel/PDF del reporte.
- [ ] Autenticación simple (entrada por contraseña/rol) si se publica fuera de la red interna.
- [ ] Alerta/anotación de "Sin estado" (9.169) para que jefatura impulse su normalización.

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| `estado`/`gasera` con variantes de escritura | Normalización vía diccionario + documentación |
| `VALOR PAGOS` puede venir como texto / vacío | `tryToNum` + conteo de nulos + aviso visual |
| BD lenta en agrupaciones grandes | Índice en `fecha_radicacion` y `estado`; filtros por año; caché |
| Filtro por contrato amplio | `ILIKE '%...%'` con límite de resultados + debounce |
| IP interna expuesta | Solo en `.env`; nunca en docs/README |
| Contraseña vista en el chat | **Rotar la contraseña** al finalizar |
| Contrato real visible en capturas | No incluir capturas con datos reales en el repo |

## 7. Cronograma sugerido

| Fase  | Esfuerzo estimado | Depende de |
|-------|-------------------|------------|
| Fase 0 | 0,5 día  | — |
| Fase 1 | 0,5 día  | 0 |
| Fase 2 | 0,5 día  | 1 |
| Fase 3 | 1 día    | 1 |
| Fase 4 | 0,5 día  | 2, 3 |
| Fase 5 | 0,5–1 día | 1, 4 |
| Fase 6 | 1 día    | paralelo a 2–5 |
| Fase 7 | 0,5 día  | 6 |
| Fase 8 | 0,5 día  | todo |

**Total aproximado: 5–6 días hábiles.**

## 8. Endpoints API (contrato)

Todos devuelven JSON, aceptan los mismos query params: `contrato`, `desde`, `hasta`, `gasera`, `producto`.

```
GET /api/kpis            → { total, pagados, objetados, solicitudDocs, totalPagado, extra }
GET /api/tendencia       → [{ mes, total, valorPagado }]
GET /api/por-aseguradora → [{ mes, aseguradora, total }]
GET /api/por-gasera      → [{ gasera, total }]
GET /api/por-producto    → [{ producto, total }]
GET /api/tabla?page=&size= → { registros: [...], total }
GET /api/metadatos       → { gaseras[], productos[], rangoFechas, anios }
```

## 9. Checklist de seguridad pre-push

- [ ] `git status` — confirmar que `.env` NO aparece.
- [ ] `git grep -i "XumaBD" HEAD $(git rev-list --all)` — sin coincidencias.
- [ ] `git log --oneline` — mensajes y diffs limpios.
- [ ] `.env.example` con valores ficticios (OK por definición).

---

*Plan aprobado el 17-sep-2026 por el equipo de análisis.*