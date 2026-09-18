// Tipos compartidos entre el backend (endpoints) y el frontend (islas React).

export interface Filters {
  contrato?: string;
  desde?: string;   // YYYY-MM-DD
  hasta?: string;   // YYYY-MM-DD
  mes?: string;     // YYYY-MM (tiene prioridad sobre desde/hasta)
  gasera?: string;
  producto?: string;
  anio?: string;       // YYYY (vista de estatus)
  estado?: string;
  aseguradora?: string;
}

export interface KpisData {
  total: number;
  pagados: number;
  objetados: number;
  solicitudDocs: number;
  enTramite: number;
  totalPagado: number;
  sinEstado: number;
  comparativo: {
    total2025: number;
    total2026: number;
    deltaPct: number;
  };
}

export interface PuntoTendencia {
  mes: string;
  label: string;
  total: number;
  valorPagado: number;
}

export interface SerieAseguradora {
  mes: string;
  label: string;
  porAseguradora: Record<string, number>;
}

export interface ItemGasera {
  gasera: string;
  total: number;
}

export interface ItemProducto {
  producto: string;
  total: number;
}

export interface RegistroTabla {
  id_caso: number;
  numero_contrato: string | null;
  nombre_asegurado: string | null;
  aseguradora: string;
  gasera: string;
  producto: string;
  estado: string;
  fecha_radicacion: string | null;
  monto: number | null;
}

export interface PaginaTabla {
  registros: RegistroTabla[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Metadatos {
  anios: number[];
  rangoFechas: { min: string | null; max: string | null };
  gaseras: string[];
  productos: string[];
  estados: { estado: string; total: number }[];
  aseguradoras: string[];
}

export interface FilaEstatus {
  gasera: string;
  mes: number;   // 1..12
  total: number;
}

export interface EstatusData {
  anio: number;
  gaseras: string[];
  filas: FilaEstatus[];
}

export interface DashboardData {
  kpis: KpisData;
  tendencia: PuntoTendencia[];
  porAseguradora: SerieAseguradora[];
  porGasera: ItemGasera[];
  porProducto: ItemProducto[];
  metadatos: Metadatos;
}

export interface RespuestaError {
  error: string;
}