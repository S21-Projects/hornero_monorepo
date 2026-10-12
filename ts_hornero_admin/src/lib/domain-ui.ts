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
  OFRECIDA:                { tone: 'sky',     label: 'Ofrecida' },
  ACEPTADA:                { tone: 'ok',      label: 'Aceptada' },
  RECHAZADA:               { tone: 'danger',  label: 'Rechazada' },
  EN_CAMINO:               { tone: 'neutral', label: 'En camino' },
  PENDIENTE_CONFIRMACION:  { tone: 'neutral', label: 'Pendiente de confirmación' },
  ENTREGADA:               { tone: 'ok',      label: 'Entregada' },
  CANCELADA:               { tone: 'danger',  label: 'Cancelada' },
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
  SIN_RECLAMAR: { tone: 'neutral', label: 'Sin reclamar' },
  INACTIVA:  { tone: 'neutral', label: 'Inactiva' },
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

/** `ModalidadDonacion` (slice 5e/5f, `specs/donacion-fondo-comun`). */
export const MODALIDAD_DONACION: Record<string, BadgeConfig> = {
  DIRECTA:     { tone: 'sky',     label: 'Directa' },
  FONDO_COMUN: { tone: 'neutral', label: 'Fondo común' },
};

/**
 * `CategoriaAlimento` (feature catalogo-articulos). Shared by the articulo catalog screen and —
 * once work units F/G/H land — the donación línea and necesidad articulo pickers.
 */
export const CATEGORIA_ALIMENTO: Record<string, BadgeConfig> = {
  NO_PERECEDERO: { tone: 'neutral', label: 'No perecedero' },
  REFRIGERADO:   { tone: 'sky',     label: 'Refrigerado' },
  CONGELADO:     { tone: 'sky',     label: 'Congelado' },
};

/** `UnidadArticulo` (feature catalogo-articulos). Plain lowercase unit labels, not a badge. */
export const UNIDAD_ARTICULO: Record<string, string> = {
  KG:      'kg',
  PAQUETE: 'paquete',
  LITRO:   'litro',
  UNIDAD:  'unidad',
};

/** `FaseDonacion` (AD-4) — only the two pool-only phases need their own label here (T5); the
 * rest overlap with `ESTADO_DONACION`'s existing labels. */
export const FASE_DONACION: Record<string, BadgeConfig> = {
  EN_FONDO: { tone: 'neutral', label: 'En espera de asignación' },
  ASIGNADA: { tone: 'sky',     label: 'Asignada' },
};

/**
 * N10 activity log: Spanish labels for the MS `TipoActividad` values. An unknown code (a newer MS)
 * renders as the raw code, see `labelAccion`.
 */
export const ACCION_ACTIVIDAD: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  REGISTRO: 'Registro de cuenta',
  REFRESH_TOKEN: 'Renovación de sesión',
  REFRESH_TOKEN_REUTILIZADO: 'Reutilización de token de sesión',
  OTP_VERIFICACION: 'Verificación de email',
  OTP_BLOQUEO: 'Bloqueo por intentos de verificación',
  ENTREGA_CODIGO_GENERADO: 'Código de entrega generado',
  ENTREGA_CODIGO_VERIFICACION: 'Verificación de código de entrega',
  ENTREGA_CODIGO_BLOQUEO: 'Bloqueo de código de entrega',
  USUARIO_ACTIVADO: 'Usuario activado',
  USUARIO_DESACTIVADO: 'Usuario desactivado',
  ORGANIZACION_CREADA: 'Organización creada',
  ORGANIZACION_VALIDADA: 'Organización validada',
  ORGANIZACION_RECHAZADA: 'Organización rechazada',
  ORGANIZACION_ACTUALIZADA: 'Organización actualizada',
  ORGANIZACION_REFERENTE_REASIGNADO: 'Referente reasignado',
  ORGANIZACION_INFO_PUBLICA_EDITADA: 'Información pública editada',
  ORGANIZACION_INFO_PUBLICA_APROBADA: 'Información pública aprobada',
  ORGANIZACION_INFO_PUBLICA_RECHAZADA: 'Información pública rechazada',
  NECESIDAD_CREADA: 'Necesidad creada',
  NECESIDAD_ACTUALIZADA: 'Necesidad actualizada',
  NECESIDAD_ELIMINADA: 'Necesidad eliminada',
  NECESIDAD_RELANZADA: 'Necesidad relanzada',
  NECESIDADES_VENCIDAS: 'Necesidades vencidas (automático)',
  DONACION_CREADA: 'Donación creada',
  DONACION_DECISION: 'Decisión sobre donación',
  DONACION_ESTADO_ACTUALIZADO: 'Estado de donación actualizado',
  DONACION_CANCELADA: 'Donación cancelada',
  DONACION_ELIMINADA: 'Donación eliminada',
  DONACION_OVERRIDE: 'Estado de donación forzado',
  RONDA_EJECUTADA: 'Ronda ejecutada',
  ARTICULO_CREADO: 'Artículo creado',
  ARTICULO_ACTUALIZADO: 'Artículo actualizado',
  ARTICULO_DESACTIVADO: 'Artículo desactivado',
  ARTICULO_REACTIVADO: 'Artículo reactivado',
  TOKENS_PURGADOS: 'Limpieza de sesiones vencidas',
  ACTIVIDAD_PURGADA: 'Purga por retención',
  USUARIO_ANONIMIZADO: 'Usuario anonimizado',
  EMAIL_INTENTO_PURGADO: 'Correos de intentos fallidos borrados (automático)',
  COORDENADAS_MINIMIZADAS: 'Coordenadas de donaciones reducidas (automático)',
};

export function labelAccion(codigo: string): string {
  return ACCION_ACTIVIDAD[codigo] ?? codigo;
}

export const RESULTADO_ACTIVIDAD: Record<string, BadgeConfig> = {
  EXITO: { tone: 'ok', label: 'Éxito' },
  FALLO: { tone: 'danger', label: 'Fallo' },
};

export const ACTOR_ACTIVIDAD: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  REFERENTE: 'Referente',
  DONANTE: 'Donante',
  SISTEMA: 'Sistema',
  ANONIMO: 'Sin sesión',
};

export const ENTIDAD_ACTIVIDAD: Record<string, string> = {
  USUARIO: 'Usuario',
  ORGANIZACION: 'Organización',
  NECESIDAD: 'Necesidad',
  DONACION: 'Donación',
  ARTICULO: 'Artículo',
  RONDA: 'Ronda',
};
