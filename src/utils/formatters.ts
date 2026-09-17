// Formateadores de moneda (COP), números, fechas y meses.

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function formatCOP(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '$0';
  return COP.format(value);
}

export function formatNum(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–';
  return NUM.format(value);
}

const COMPACTO = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const COMPACTO_COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

// Números y montos en notación compacta (12,3 mil · $2,5 B) para etiquetas de gráficos.
export function formatNumCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '';
  return COMPACTO.format(value);
}

export function formatCOPCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return '';
  return COMPACTO_COP.format(value);
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function mesLabel(isoMes: string): string {
  const m = Number(isoMes.slice(5, 7));
  return `${MESES[m - 1] ?? isoMes} ${isoMes.slice(0, 4)}`;
}

export function mesCorto(isoMes: string): string {
  const m = Number(isoMes.slice(5, 7));
  return (MESES[m - 1] ?? isoMes).slice(0, 3);
}

export function formatFecha(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}