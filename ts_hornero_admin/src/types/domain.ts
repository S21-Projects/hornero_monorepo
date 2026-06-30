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
  OFRECIDA:  'OFRECIDA',
  EN_CAMINO: 'EN_CAMINO',
  ENTREGADA: 'ENTREGADA',
  CANCELADA: 'CANCELADA',
} as const;
export type EstadoDonacion = typeof EstadoDonacion[keyof typeof EstadoDonacion];

export interface Organizacion {
  id: number;
  slug: string;
  nombre: string;
  validada: boolean;
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
  necesidadId: number;
  organizacionId?: number;
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
