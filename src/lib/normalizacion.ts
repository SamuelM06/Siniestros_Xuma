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
  WHEN c.estado ILIKE '%PAGAD%' OR c.estado ILIKE '%PAGO%' THEN 'Pagado'
  WHEN c.estado ILIKE '%OBJETAD%' THEN 'Objetado'
  WHEN c.estado ILIKE '%DOCUMENTO%' OR c.estado ILIKE '%PENDIENTE%' OR c.estado ILIKE '%LLAMADA%' THEN 'Solicitud de documentos'
  WHEN c.estado ILIKE '%TRAMIT%' OR c.estado ILIKE '%TRÁMIT%' OR c.estado ILIKE '%SEGUIMIENTO%' OR c.estado ILIKE '%ABIERT%' OR c.estado ILIKE '%SUSPENSO%' OR c.estado ILIKE '%COORDINAR%' OR c.estado ILIKE '%APERTUR%' THEN 'En trámite'
  WHEN c.estado ILIKE '%CONCLU%' OR c.estado ILIKE '%CERRADO%' OR c.estado ILIKE '%DIRECTO%' OR c.estado ILIKE '%EXHUMACION%' THEN 'Concluido'
  WHEN c.estado ILIKE '%NEGAD%' OR c.estado ILIKE '%ANULAD%' OR c.estado ILIKE '%NO FALLECID%' OR c.estado ILIKE '%NO PRESTAD%' OR c.estado ILIKE '%RETORNO%' OR c.estado ILIKE '%VOLTEO%' THEN 'Negado / Anulado'
  WHEN c.estado ILIKE '%REVISION%' THEN 'En revisión'
  WHEN c.estado IS NULL OR btrim(c.estado) = '' THEN 'Sin estado'
  ELSE initcap(NULLIF(btrim(c.estado),''))
END`;

// ---- GASERA → alias canónico -------------------------------------------------
export const GASERA_SQL = `
CASE
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GDO%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES DE OCCIDENTE%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES DEL OCCIDENTE%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'GASES%OCCIDENTE%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GDO PROEXEQUIAL%' THEN 'Gdo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%CARIBE%' THEN 'Gases del Caribe'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'SURTIGAS%' THEN 'Surtigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'EFIGAS%' THEN 'Efigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%GUAJIRA%' THEN 'Gases de La Guajira'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'PROMIGAS%' THEN 'Promigas'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'CEO' THEN 'Ceo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE 'COMPAÑIA ENERGETICA DE%' THEN 'Ceo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%ENERG%' THEN 'Ceo'
  WHEN btrim(COALESCE(c.gasera,'')) ILIKE '%PROEXEQUIAL%' THEN 'Proexequial (aliado)'
  WHEN btrim(COALESCE(c.gasera,'')) = '' THEN 'Sin gasera'
  ELSE initcap(NULLIF(btrim(c.gasera),''))
END`;

// ---- PRODUCTO → etiqueta canónica --------------------------------------------
// Se analizan los campos reales de cada aseguradora (RAMO, Nomproducto, MODALIDAD,
// SEGURO, Ramo_Desc, PRODUCTO, etc.) y se descartan valores espurios puramente numéricos.
export const PRODUCTO_SQL = `
CASE
  -- 1. Vida Deudor / Grupo Deudores (archivos, ramos o valores explícitos)
  WHEN c.nombre_archivo_origen ILIKE '%vida deudor%' THEN 'Grupo Deudores'
  WHEN btrim(COALESCE(c.datos_originales->>'RAMO','')) ILIKE '%DEUDOR%' THEN 'Grupo Deudores'
  WHEN btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) ILIKE '%DEUDOR%' THEN 'Grupo Deudores'

  -- 2. Salvafactura
  WHEN c.nombre_archivo_origen ILIKE '%salvafactura%' THEN 'Salvafactura'
  WHEN btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) ILIKE '%SALVAFACTURA%' THEN 'Salvafactura'

  -- 3. Cardif (Nomproducto comercial)
  WHEN btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%ACCID%' THEN 'Accidentes Personales'
  WHEN btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%CANCER%' OR btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%C_NCER%' THEN 'Cáncer'
  WHEN btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%VIDA GRUPO%' OR btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%VIDA%' THEN 'Vida Grupo'
  WHEN btrim(COALESCE(c.datos_originales->>'Nomproducto','')) ILIKE '%DEUDOR%' THEN 'Grupo Deudores'
  WHEN NULLIF(btrim(c.datos_originales->>'Nomproducto'),'') IS NOT NULL 
   AND (c.datos_originales->>'Nomproducto') !~ '^[0-9.,[:space:]]+$'
   THEN initcap(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Nomproducto'), '^[0-9]+[[:space:]]*-[[:space:]]*', '', 'g'), '_', ' ', 'g'))

  -- 4. HDI (Modalidad / Amparo)
  WHEN btrim(COALESCE(c.datos_originales->>'MODALIDAD','')) ILIKE '%FUTURO PROTEGIDO%' THEN 'Seguro Futuro Protegido'
  WHEN btrim(COALESCE(c.datos_originales->>'MODALIDAD','')) ILIKE '%FUNERARIO%' 
    OR btrim(COALESCE(c.datos_originales->>'AMPARO','')) ILIKE '%EXEQUIAS%' THEN 'Seguro Funerario'
  WHEN btrim(COALESCE(c.datos_originales->>'MODALIDAD','')) ILIKE '%ENFERMEDADES GRAVES%' 
    OR btrim(COALESCE(c.datos_originales->>'AMPARO','')) ILIKE '%ENFERMEDADES GRAVES%' THEN 'Enfermedades Graves'

  -- 5. SURA (Ramo_Desc / SEGURO / Nombre_plan)
  WHEN btrim(COALESCE(c.datos_originales->>'Ramo_Desc','')) ILIKE '%VIDA DE GRUPO%' THEN 'Vida Grupo'
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%MERCADO ASEGURADO%' THEN 'Mercado Asegurado'
  WHEN btrim(COALESCE(c.datos_originales->>'Nombre_plan','')) ILIKE '%VIDA%' THEN 'Vida Grupo'

  -- 6. Campo SEGURO (Alfa / HDI / SURA)
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%PRACTISEGURO%' THEN 'Practiseguro'
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%FUTURO PROTEGIDO%' THEN 'Seguro Futuro Protegido'
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%PAZ Y SALVO%' OR btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%LIBERTY%' THEN 'Seguro de Vida'
  WHEN btrim(COALESCE(c.datos_originales->>'SEGURO','')) ILIKE '%ENFERMEDADES GRAVES%' THEN 'Enfermedades Graves'

  -- 7. Campo PRODUCTO descriptivo (DESCARTA VALORES PURAMENTE NUMÉRICOS)
  WHEN (c.datos_originales->>'PRODUCTO') IS NOT NULL 
   AND (c.datos_originales->>'PRODUCTO') !~ '^[0-9.,[:space:]]+$'
   AND btrim(COALESCE(c.datos_originales->>'PRODUCTO','')) <> '' THEN
    CASE
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%FUTURO PROTEGIDO%' THEN 'Seguro Futuro Protegido'
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%FUNERARIO%' THEN 'Seguro Funerario'
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%PRACTISEGURO%' THEN 'Practiseguro'
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%PROTECTOR%' THEN 'Seguro Protector'
      WHEN btrim(c.datos_originales->>'PRODUCTO') ILIKE '%VIDA%' THEN 'Seguro de Vida'
      ELSE initcap(regexp_replace(regexp_replace(btrim(c.datos_originales->>'PRODUCTO'), '^[0-9]+[[:space:]]*-[[:space:]]*', '', 'g'), '_', ' ', 'g'))
    END

  -- 8. Otros campos secundarios (RAMO, Nombre_plan)
  WHEN btrim(COALESCE(c.datos_originales->>'RAMO','')) ILIKE '%VIDA%' THEN 'Vida Grupo'
  WHEN btrim(COALESCE(c.datos_originales->>'RAMO','')) ILIKE '%EXEQUI%' OR btrim(COALESCE(c.datos_originales->>'RAMO','')) ILIKE '%FUNERARI%' THEN 'Seguro Funerario'

  ELSE 'Sin producto'
END`;

// ---- MONTO (Total Pagado) ----------------------------------------------------
// Captura todas las variantes de columnas usadas por aseguradoras (Cardif, HDI, Alfa, etc.)
// y sanea centavos ([,.]\\d{2}$) para evitar que valores con decimales se multipliquen por 100.
export const MONTO_SQL = `
COALESCE(
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR PAGOS'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Valor_Pagos'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'MONTO PAGADO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR -PAGADO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR PAGADO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR PAGADO '), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR_SOLICITUD_GIRO'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'PagoReal'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'Pagocomercial'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric,
  NULLIF(regexp_replace(regexp_replace(btrim(c.datos_originales->>'VALOR_TOTAL'), '[,.]\\d{2}$', ''), '[^0-9]', '', 'g'), '')::numeric
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