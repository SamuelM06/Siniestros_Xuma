# Idea del Proyecto — Dashboard de Siniestros Xuma 2026

## Contexto del negocio

**Xuma** (marca del grupo, color azul reflex `#120180` y verdes `#5AE280` / `#00CD93`) opera como
corredora/mesa de siniestros para varias aseguradoras del sector de gas natural (gaseras). La
información de los siniestros vive en una base de datos **PostgreSQL** (`DataCenter_Promigas`),
esquema **`siniestros`**, dentro de un Data Center corporativo.

Como analista de datos, se necesita un **reporte/dashboard web** que muestre el estado de los
siniestros **del año 2026** para presentárselo a la jefatura: KPIs, gráficos de tendencia y
participación (aseguradora, gasera, producto), tabla de detalle y filtros.

## Objetivo

Construir un **portal web responsivo y altamente animado** (nada estático) que permita:

1. Mostrar una **sesión de bienvenida** con el contexto del reporte.
2. Ver **KPIs** del periodo: Total de Siniestros, Pagados, Objetados, Solicitud de Documentos y
   Total Pagado (valor en pesos).
3. Visualizar **gráficos animados**:
   - Cantidad de siniestros por aseguradora al mes (barras).
   - Cantidad de siniestros por gasera (barras horizontales o dona).
   - Tendencia mensual (línea con área).
   - Porciones / participación por aseguradora y producto (dona/pie).
4. Filtrar por: **contrato** (input de texto), **rango de fecha**, **gasera** y **producto**.
5. Ver una **tabla de detalle** paginada con los registros bajo los filtros activos.
6. Todo con la **identidad visual de Xuma** (colores, Raleway, logo) y con **animaciones**:
   fondo animado con blur/gradientes, conteos progresivos, gráficos que se dibujan, transiciones.

## Fuentes de datos (esquema `siniestros`)

| Tabla            | Rol                                                    | Registros |
|------------------|--------------------------------------------------------|-----------|
| `casos`          | Registros de siniestros (la tabla principal)           | ~28.882   |
| `aseguradoras`   | Catálogo de aseguradoras (nombre, slug, logo)          | 5         |
| `cargas`         | Bitácora de cargas de archivos por aseguradora         | 12        |
| `log_accesos`    | Auditoría de consultas por contrato (7/24)             | 9         |

Punto clave descubierto en exploración: **`casos` no tiene una columna explícita de "producto"
ni de "valor pagado"**. Esos datos viven en el campo **JSONB `datos_originales`** del propio
registro (`Ramo_Desc` / `Ramoproducto` para producto; `VALOR PAGOS` / `VALOR INCURRIDO` para
montos). Además los campos `estado` y `gasera` tienen **muchas variantes de escritura** que hay
que normalizar antes de graficar.

## Reglas innegociables (seguridad)

- Las credenciales **nunca** van en código ni en archivos versionados.
- Solo existe `.env` (local, gitignored) y `.env.example` (público, con valores ficticios).
- El navegador **nunca** consulta PostgreSQL directamente: todo pasa por la API del backend
  (endpoints de Astro en `src/pages/api/`).
- Antes de cada commit: revisar que no haya credenciales, IPs internas ni contratos reales.

## Reglas visuales de marca (resumen)

| Elemento            | Valor                                      |
|---------------------|--------------------------------------------|
| Azul Reflex (PMS)   | `#120180`                                  |
| Verde Claro         | `#5AE280`                                  |
| Verde Oscuro        | `#00CD93`                                  |
| Gris Oscuro / Negro | `#333333`                                  |
| Tipografía          | **Raleway** (Regular, Medium, Bold)        |
| Logos               | `public/logos/` (copiados del Manual)      |
| Área de seguridad   | 3X alrededor del logotipo; mín. digital 150 px |

## Público

Jefatura de Xuma (un solo consumidor directo), presentado en reuniones. El dashboard debe ser
impresionante visualmente (animaciones, blur, emojis sutiles) y **legible en cualquier pantalla**
(móvil, tablet, portátil, TV de sala).

## Entregable

Repositorio git `git@github.com:SamuelM06/Siniestros_Xuma.git` con:
- Portal web Astro (index de bienvenida + dashboard).
- API backend para consultas filtrables.
- Documentación completa (`contexto/`, `docs/`, `README.md`).
- Sin información sensible en el historial.