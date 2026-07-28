/**
 * UI presentation mappings for domain enums.
 * Each entry has a `tone` (maps to Badge visual treatment) and a human-readable `label`.
 *
 * Tones: 'danger' | 'ok' | 'sky' | 'neutral'
 *   danger  → var(--urgent)  — URGENTE, VENCIDA, CANCELADA
 *   ok      → var(--ok)      — CUMPLIDA, ENTREGADA
 *   sky     → var(--sky)     — ABIERTA, OFRECIDA
 *   neutral → muted gray     — MEDIA, NORMAL, EN_PROGRESO, EN_CAMINO
 */

export type BadgeTone = 'danger' | 'ok' | 'sky' | 'neutral';

export interface BadgeConfig {
  tone: BadgeTone;
  label: string;
}

export const PRIORIDAD: Record<string, BadgeConfig> = {
  URGENTE: { tone: 'danger',  label: 'Urgente' },
  MEDIA:   { tone: 'neutral', label: 'Media' },
  NORMAL:  { tone: 'neutral', label: 'Normal' },
};

export const ESTADO_NECESIDAD: Record<string, BadgeConfig> = {
  ABIERTA:     { tone: 'sky',     label: 'Abierta' },
  EN_PROGRESO: { tone: 'neutral', label: 'En progreso' },
  CUMPLIDA:    { tone: 'ok',      label: 'Cumplida' },
  VENCIDA:     { tone: 'danger',  label: 'Vencida' },
};

export const ESTADO_DONACION: Record<string, BadgeConfig> = {
  OFRECIDA:  { tone: 'sky',     label: 'Ofrecida' },
  EN_CAMINO: { tone: 'neutral', label: 'En camino' },
  ENTREGADA: { tone: 'ok',      label: 'Entregada' },
  CANCELADA: { tone: 'danger',  label: 'Cancelada' },
};

/** Fallback for any unknown enum value. Never throws. */
export const FALLBACK_BADGE: BadgeConfig = { tone: 'neutral', label: '—' };

// ---------------------------------------------------------------------------
// Admin badge configs (Slice 6)
// ---------------------------------------------------------------------------

export const ESTADO_ORGANIZACION: Record<string, BadgeConfig> = {
  PENDIENTE: { tone: 'sky',     label: 'Pendiente' },
  APROBADA:  { tone: 'ok',      label: 'Aprobada' },
  RECHAZADA: { tone: 'danger',  label: 'Rechazada' },
};

export const TIPO_ORGANIZACION: Record<string, BadgeConfig> = {
  COMEDOR:   { tone: 'neutral', label: 'Comedor' },
  COPITA:    { tone: 'neutral', label: 'Copita' },
  ROPERO:    { tone: 'neutral', label: 'Ropero' },
  MERENDERO: { tone: 'neutral', label: 'Merendero' },
  OTRO:      { tone: 'neutral', label: 'Otro' },
};

/** Keyed by stringified boolean: 'true' | 'false'. */
export const ACTIVO: Record<string, BadgeConfig> = {
  'true':  { tone: 'ok',      label: 'Activo' },
  'false': { tone: 'neutral', label: 'Inactivo' },
};
