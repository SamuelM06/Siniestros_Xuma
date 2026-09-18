// ============================================================================
// NORMALIZACIÓN DE DIMENSIONES
// ----------------------------------------------------------------------------
// La base `siniestros.casos` guarda estados, gaseras y productos con mucha
// variación de escritura (resultado de cargar archivos de distintas
// aseguradoras). Aquí se definen las reglas canónicas UNA sola vez, como
// fragmentos SQL reutilizables (alias de tabla SIEMPRE `c`), más helpers para
// la capa de presentación.
// ============================================================================

// ---- ESTADO → categoría canónica -------------------------------------------
export const ESTADO_SQL = `
CASE
  WHEN c.estado ILIKE '%PAGAD%' OR c.estado ILIKE '%PAGO CERRADO%' OR c.estado ILIKE '%PROCESO PAGO%' THEN 'Pagado'
  WHEN c.estado ILIKE '%OBJETAD%' THEN 'Objetado'
  WHEN c.estado ILIKE '%DOCUMENTO%' OR c.estado ILIKE '%PENDIENTE%' OR c.estado ILIKE '%LLAMADA%' THEN 'Solicitud de documentos'
  WHEN c.estado ILIKE '%TRAMIT%' OR c.estado ILIKE '%SEGUIMIENTO%' OR c.estado ILIKE '%ABIERT%' OR c.estado ILIKE '%SUSPENSO%' OR c.estado ILIKE '%COORDINAR%' OR c.estado ILIKE '%APERTUR%' THEN 'En trámite'
  WHEN c.estado ILIKE '%CONCLU%' OR c.estado ILIKE '%CERRADO%' OR c.estado ILIKE '%DIRECTO%' OR c.estado ILIKE '%EXHUMACION%' THEN 'Concluido'
  WHEN c.estado ILIKE '%NEGAD%' OR c.estado ILIKE '%ANULAD%' OR c.estado ILIKE '%NO FALLECID%' OR c.estado ILIKE '%NO PRESTAD%' OR c.estado ILIKE '%RETORNO%' OR c.estado ILIKE '%VOLTEO%' THEN 'Negado / Anulado'
  WHEN c.estado ILIKE '%REVISION%' THEN 'En revisión'
  WHEN c.estado IS NULL OR btrim(c.estado) = '' THEN 'Sin estado'
  ELSE initcap(NULLIF(btrim(c.estado),''))
END`;

// ---- GASERA → alias canónico -------------------------------------------------
export const GASERA_SQL = `
CASE
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GDO%' THEN 'Gases de Occidente (GDO)'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES DE OCCIDENTE%' THEN 'Gases de Occidente (GDO)'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES DEL OCCIDENTE%' THEN 'Gases de Occidente (GDO)'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES%OCCIDENTE%' THEN 'Gases de Occidente (GDO)'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GDO PROEXEQUIAL%' THEN 'Gases de Occidente (GDO)'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%CARIBE%' THEN 'Gases del Caribe'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'SURTIGAS%' THEN 'Surtigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'EFIGAS%' THEN 'Efigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GUAJIRA%' THEN 'Gases de La Guajira'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'PROMIGAS%' THEN 'Promigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'CEO' THEN 'Compañía Energética de Occidente (CEO)'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'COMPAÑIA ENERGETICA DE%' THEN 'Compañía Energética de Occidente (CEO)'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%ENERG%' THEN 'Compañía Energética de Occidente (CEO)'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%PROEXEQUIAL%' THEN 'Proexequial (aliado)'
  WHEN btrim(COALESCE(c.gasera,'')) = '' THEN 'Sin gasera'
  ELSE initcap(NULLIF(btrim(c.gasera),''))
END`;

// ---- PRODUCTO → etiqueta canónica --------------------------------------------
// Alfa/HDI/Proexequial/SURA(interacción) usan `PRODUCTO`; Cardif usa
// `Nomproducto` (con prefijos de código tipo "6202-"); SURA usa `Ramo_Desc`.
export const PRODUCTO_SQL = `
CASE
  WHEN btrim(COALESCE(c.datos_originales->>'Ramo_Desc','')) ILIKE '%VIDA DE GRUPO%' THEN 'Vida Grupo'
  WHEN NULLIF(btrim(c.datos_originales->>'Ramo_Desc'),'') IS NOT NULL THEN initcap(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Ramo_Desc'), '^[0-9]+[[:space:]]*-[[:space:]]*', '', 'g'), '_', ' ', 'g'))
  WHEN btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) ILIKE '%GRUPO DEUDORES%' THEN 'Grupo Deudores'
  WHEN btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) ILIKE '%FUTURO PROTEGIDO%' THEN 'Seguro Futuro Protegido'
  WHEN btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) ILIKE '%VIDA%' THEN 'Seguro de Vida'
  WHEN NULLIF(btrim(c.datos_originales->>'PRODUCTO'),'') IS NOT NULL THEN initcap(regexp_replace(regexp_replace(btrim(c.datos_originales->>'PRODUCTO'), '^[0-9]+[[:space:]]*-[[:space:]]*', '', 'g'), '_', ' ', 'g'))
  WHEN NULLIF(btrim(c.datos_originales->>'Nomproducto'),'') IS NOT NULL
       THEN initcap(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Nomproducto'), '^[0-9]+[[:space:]]*-[[:space:]]*', '', 'g'), '_', ' ', 'g'))
  ELSE 'Sin producto'
END`;

// ---- MONTO (Total Pagado) ----------------------------------------------------
// Cada aseguradora trae el valor pagado bajo una llave distinta del JSONB:
//   HDI  → 'VALOR PAGOS'   Cardif → 'Valor_Pagos'   Alfa → 'VALOR'
// Se sanean a número puro de enteros (los valores son pesos colombianos).
export const MONTO_SQL = `
COALESCE(
  NULLIF(regexp_replace(btrim(c.datos_originales->>'VALOR PAGOS'), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(btrim(c.datos_originales->>'Valor_Pagos'), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(btrim(c.datos_originales->>'VALOR'), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(btrim(c.datos_originales->>'PagoReal'), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(btrim(c.datos_originales->>'Pagocomercial'), '[^0-9]', '', 'g'), '')::numeric
)`;

// ---- Estados canónicos para la UI (badges, leyendas) --------------------------
export const CATEGORIAS_ESTADOS = [
  'Pagado',
  'Objetado',
  'Solicitud de documentos',
  'En trámite',
  'Concluido',
  'Negado / Anulado',
  'En revisión',
  'Sin estado',
] as const;

export function estadoColorCat(estado: string): 'verde' | 'rojo' | 'ambar' | 'azul' | 'morado' | 'gris' | 'cyan' {
  switch (estado) {
    case 'Pagado':
      return 'verde';
    case 'Objetado':
      return 'rojo';
    case 'Solicitud de documentos':
      return 'ambar';
    case 'En trámite':
      return 'azul';
    case 'Concluido':
      return 'cyan';
    case 'Negado / Anulado':
      return 'rojo';
    case 'En revisión':
      return 'morado';
    default:
      return 'gris';
  }
}