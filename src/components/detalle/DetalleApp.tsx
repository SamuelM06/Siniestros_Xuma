import { useCallback, useState } from 'react';
import type { Filters, Metadatos, PaginaTabla } from '../../lib/types';
import FiltrosPanel from '../filtros/FiltrosPanel';
import TablaSiniestros from '../tabla/TablaSiniestros';

interface Props {
  metadatos: Metadatos;
  filtrosIniciales: Filters;
  datosIniciales?: PaginaTabla;
}

const DEFAULT_DESDE = '2026-01-01';
const DEFAULT_HASTA = '2026-12-31';

// Vista de detalle: filtros + tabla paginada y exportable de siniestros.
export default function DetalleApp({ metadatos, filtrosIniciales, datosIniciales }: Props) {
  const [filtros, setFiltros] = useState<Filters>(filtrosIniciales);

  const cambioFiltro = useCallback((cambio: Partial<Filters>) => {
    setFiltros((prev) => ({ ...prev, ...cambio }));
  }, []);

  const resetFiltros = useCallback(() => {
    setFiltros({
      contrato: undefined,
      mes: undefined,
      desde: DEFAULT_DESDE,
      hasta: DEFAULT_HASTA,
      gasera: undefined,
      producto: undefined,
      linea: undefined,
      estado: undefined,
    });
  }, []);

  const activos =
    (filtros.contrato ? 1 : 0) +
    (filtros.gasera ? 1 : 0) +
    (filtros.producto ? 1 : 0) +
    (filtros.linea ? 1 : 0) +
    (filtros.estado ? 1 : 0) +
    (filtros.aseguradora ? 1 : 0) +
    (filtros.mes ? 1 : 0) +
    ((filtros.desde && filtros.desde !== DEFAULT_DESDE && !filtros.mes) ? 1 : 0) +
    ((filtros.hasta && filtros.hasta !== DEFAULT_HASTA && !filtros.mes) ? 1 : 0);

  return (
    <div className="space-y-6">
      <FiltrosPanel
        filtros={filtros}
        metadatos={metadatos}
        onChange={cambioFiltro}
        onReset={resetFiltros}
        activos={activos}
      />
      <TablaSiniestros filtros={filtros} datosIniciales={datosIniciales} />
    </div>
  );
}
