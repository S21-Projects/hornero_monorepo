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
