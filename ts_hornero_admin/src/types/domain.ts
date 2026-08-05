// Domain types for the DONANTE SPA views (Slice 4).
// Keep in sync with Java MS discriminator values and BFF DTOs.
//
// Note: enums are not used because `erasableSyntaxOnly` is enabled in tsconfig.
// Use `as const` objects + derived union types instead.

export const PrioridadNecesidad = {
  URGENTE: 'URGENTE',
  MEDIA:   'MEDIA',
  NORMAL:  'NORMAL',
} as const;
export type PrioridadNecesidad = typeof PrioridadNecesidad[keyof typeof PrioridadNecesidad];

export const EstadoNecesidad = {
  ABIERTA:     'ABIERTA',
  EN_PROGRESO: 'EN_PROGRESO',
  CUMPLIDA:    'CUMPLIDA',
  VENCIDA:     'VENCIDA',
} as const;
export type EstadoNecesidad = typeof EstadoNecesidad[keyof typeof EstadoNecesidad];

export const EstadoDonacion = {
  OFRECIDA:                'OFRECIDA',
  ACEPTADA:                'ACEPTADA',
  RECHAZADA:               'RECHAZADA',
  EN_CAMINO:               'EN_CAMINO',
  PENDIENTE_CONFIRMACION:  'PENDIENTE_CONFIRMACION',
  ENTREGADA:               'ENTREGADA',
  CANCELADA:               'CANCELADA',
} as const;
export type EstadoDonacion = typeof EstadoDonacion[keyof typeof EstadoDonacion];

// --- Info pública (aceptaDonaciones, sitioWebUrl, donacionDirectaUrl) ---
// Live values are always present on any authenticated response. Pending
// values are populated only while a referente-submitted change awaits
// admin approval (infoPublicaPendienteEn non-null); the public Astro site
// never sees the pending trio (server-side gating at the MS, D6).
export interface InfoPublica {
  aceptaDonaciones: boolean;
  sitioWebUrl?: string | null;
  donacionDirectaUrl?: string | null;
}

export interface InfoPublicaPendiente {
  aceptaDonacionesPendiente?: boolean | null;
  sitioWebUrlPendiente?: string | null;
  donacionDirectaUrlPendiente?: string | null;
  infoPublicaPendienteEn?: string | null;
}

export interface Organizacion extends InfoPublica, InfoPublicaPendiente {
  id: number;
  slug: string;
  nombre: string;
  validada: boolean;
  estado: EstadoOrganizacion;
  referenteId?: number | null;
  profileImageKey?: string | null;
  bannerKey?: string | null;
}

export interface CrearOrganizacionInput {
  nombre: string;
  tipo: TipoOrganizacion;
  direccion?: string;
  descripcion?: string;
  latitud: number;
  longitud: number;
}

export interface Necesidad {
  id: number;
  descripcion: string;
  prioridad: PrioridadNecesidad;
  estado: EstadoNecesidad;
  fechaPublicacion?: string;
  fechaVencimiento?: string;
  organizacionId: number;
}

export interface Donacion {
  id: number;
  fechaOferta?: string;
  fechaEntrega?: string;
  estado: EstadoDonacion;
  observaciones?: string;
  donanteName?: string;
  donanteId?: number;
  necesidadId: number;
  organizacionId?: number;
  confirmadaDonanteEn?: string;
  confirmadaReferenteEn?: string;
}

export interface CrearDonacionInput {
  necesidadId: number;
  observaciones?: string;
}

export interface CrearNecesidadInput {
  descripcion: string;
  prioridad: PrioridadNecesidad;
  fechaVencimiento?: string;
}

export interface ActualizarNecesidadInput {
  descripcion?: string;
  prioridad?: PrioridadNecesidad;
  estado?: EstadoNecesidad;
  fechaVencimiento?: string;
}

// ---------------------------------------------------------------------------
// Admin types (Slice 6)
// ---------------------------------------------------------------------------

import type { UserRole } from '../store/auth.store';

export const EstadoOrganizacion = {
  PENDIENTE: 'PENDIENTE',
  APROBADA:  'APROBADA',
  RECHAZADA: 'RECHAZADA',
} as const;
export type EstadoOrganizacion = typeof EstadoOrganizacion[keyof typeof EstadoOrganizacion];

export const TipoOrganizacion = {
  COMEDOR:   'COMEDOR',
  COPITA:    'COPITA',
  ROPERO:    'ROPERO',
  MERENDERO: 'MERENDERO',
  OTRO:      'OTRO',
} as const;
export type TipoOrganizacion = typeof TipoOrganizacion[keyof typeof TipoOrganizacion];

export interface OrganizacionAdmin extends InfoPublica, InfoPublicaPendiente {
  id: number;
  nombre: string;
  slug: string;
  tipo: TipoOrganizacion;
  descripcion: string;
  direccion: string;
  latitud?: number;
  longitud?: number;
  estado: EstadoOrganizacion;
  referenteId?: number | null;
  referenteNombre?: string;
  referenteEmail?: string;
  validadoPorNombre?: string;
  profileImageKey?: string;
  bannerKey?: string;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  tipo: UserRole;
  activo: boolean;
}

/** Mirrors `DonacionActivaResponse` (MS) — the row shape for `/donaciones/activas` (Slice 6). */
export interface DonacionActiva {
  id: number;
  fechaOferta?: string;
  fechaEntrega?: string;
  estado: EstadoDonacion;
  observaciones?: string;
  donanteId?: number;
  donanteNombre?: string;
  necesidadId: number;
  necesidadDescripcion?: string;
  organizacionId?: number;
  organizacionNombre?: string;
  confirmadaDonanteEn?: string;
  confirmadaReferenteEn?: string;
  overrideMotivo?: string;
  overrideAdminId?: number;
  overrideEn?: string;
}
