# Manual de Marca — Aplicación en el Dashboard

> Resumen operativo de cómo se aplican las reglas visuales de **Xuma** al proyecto.
> Fuente original: copia del manual en `docs/manual-marca-fuente.md`.

## Colores corporativos

| Nombre | Hex | RGB | Uso en el dashboard |
|--------|-----|-----|---------------------|
| Azul Reflex | `#120180` | `18, 1, 128` | Fondo de sidebar/header, títulos, botón principal, línea de tendencia |
| Verde Claro | `#5AE280` | `90, 226, 128` | Acentos, KPI "Total Pagado", resaltados |
| Verde Oscuro | `#00CD93` | `0, 205, 147` | KPI "Pagados", éxito, gráficos secundarios |
| Gris Oscuro | `#333333` | `51, 51, 51` | Textos, bordes, fondos neutros |

Paleta generada (tonos de apoyo derivados, para gradientes sin romper la identidad):
- `#1a0a9e`, `#3d22c8`, `#6a4fd8` (azules derivados, claros/oscuros)
- Transparencias de los verdes con `alpha` en fondos de tarjetas.

## Tipografía

- Familia: **Raleway** — pesos **Regular (400), Medium (500), Bold (700)** (+600 para UI).
- Estrategia: woff2 **auto-hospedados en `/fonts`** (`@font-face` en `global.css`, sin CDN ni npm).
- Jerarquía: display 48px Bold (hero), H1 32px, H2 24px, cuerpo 15–16px, tabular para cifras.
- Cifras de KPIs: Raleway Bold + `font-variant-numeric: tabular-nums`.

## Logos (copiados a `public/logos/`)

| Archivo | Cuándo usarlo |
|---------|---------------|
| `Transparente_Logo_blanco_letra_blanca.svg` | Sidebar/header sobre fondo azul |
| `Transparente_Logo_azul_letra_azul.svg` | Fondo claro (bienvenida) |
| `Logo_fondoBlanco_Horizontal.png` | Footer / docs |
| `Logo_fondoVerde.png` | Sellos, fondo de tarjetas destacadas |

Reglas: área de seguridad 3X, tamaño mínimo digital 150 px, no distorsionar, no invertir colores de forma inapropiada.

## Identidad aplicada en UI

- **Glassmorphism**: tarjetas con `bg-white/10`, `backdrop-blur`, borde `white/20` sobre fondo azul profundo.
- **Fondo**: radial gradients animados con los azules/verdes corporativos + blur (`filter: blur(80px)`) en orbes.
- **Sidebar**: azul reflex profundo, logo blanco, navegación (Inicio, Dashboard) con hover animado.
- **KPIs**: cada tarjeta usa un acento de color ≠ (azul, verde claro, verde oscuro, gris) con glow sutil.
- **Gráficos**: paleta Recharts = tokens azul/verde-ligero/verde-oscuro/gris + grid apenas visible.
- **Badges de estado**: verdes para pagado, amarillos/rojos para objetado, celestes para trámite, grises para sin estado.

## Tokens CSS (ejemplo de `src/styles/global.css`)

```css
@theme {
  --color-xuma-azul: #120180;
  --color-xuma-verde-claro: #5AE280;
  --color-xuma-verde-oscuro: #00CD93;
  --color-xuma-gris: #333333;
  --font-sans: "Raleway", ui-sans-serif, system-ui, sans-serif;
}
```

## Accesibilidad y performance

- Respetar `prefers-reduced-motion` (reducir/desactivar animaciones).
- Contraste mínimo AA sobre fondos oscuros (texto blanco sobre azul `#120180`).
- Fondos animados con GPU-friendly propiedades (`transform`, `opacity`, `filter`).
- Emojis: uso **sutil** y con propósito (íconos de tarjetas), nunca decorativos en exceso.