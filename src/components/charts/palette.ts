// Paleta de gráficos derivada de la marca Xuma (azules + verdes + apoyo).
export const CHART_COLORS = [
  '#5ae280', // verde claro
  '#00cd93', // verde oscuro
  '#8b7bff', // violeta apoyo
  '#3d22c8', // azul profundo 2
  '#f0b429', // ámbar apoyo
  '#ef7a6b', // coral apoyo
  '#4cc9f0', // cian apoyo
  '#b8c0ff', // lavanda apoyo
];

// Estilo del tooltip: variables CSS (se adaptan a claro/oscuro).
export const GLASS_TOOLTIP = {
  background: 'var(--qtooltip-fondo)',
  border: '1px solid var(--qtooltip-borde)',
  borderRadius: 14,
  color: 'var(--qtooltip-tinta)',
  boxShadow: 'var(--qtooltip-sombra)',
  fontSize: 13,
  fontFamily: "'Raleway', sans-serif",
} as const;