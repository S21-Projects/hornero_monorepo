export const TIPO_ORGANIZACION_VALUES = ['COMEDOR', 'COPITA', 'ROPERO', 'MERENDERO', 'OTRO'] as const;
export type TipoOrganizacion = typeof TIPO_ORGANIZACION_VALUES[number];

export const TIPO_ORGANIZACION_LABELS: Record<TipoOrganizacion, string> = {
  COMEDOR: 'Comedor',
  COPITA: 'Copa de Leche',
  ROPERO: 'Ropero',
  MERENDERO: 'Merendero',
  OTRO: 'Otro',
};

export const TIPO_ORGANIZACION_OPTIONS = TIPO_ORGANIZACION_VALUES.map((v) => ({
  value: v,
  label: TIPO_ORGANIZACION_LABELS[v],
}));
