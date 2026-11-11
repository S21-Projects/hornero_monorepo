/** Qualitative level of a 0..1 criterion term — the single place the thresholds live. */
export type NivelCriterio = 'Baja' | 'Media' | 'Alta';
const UMBRAL_MEDIA = 0.34;
const UMBRAL_ALTA = 0.67;

export function nivelCriterio(valor: number): NivelCriterio {
  if (valor >= UMBRAL_ALTA) return 'Alta';
  if (valor >= UMBRAL_MEDIA) return 'Media';
  return 'Baja';
}
