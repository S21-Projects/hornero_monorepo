import type { TipoOrganizacion } from './tipos-organizacion';

// ─── Organizacion ──────────────────────────────────────────────────────────────

export interface Org {
  id: number;
  slug: string;
  nombre: string;
  tipo: TipoOrganizacion;
  descripcion?: string;
  direccion?: string;
  latitud?: number | null;
  longitud?: number | null;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  validada: boolean;
  referenteNombre?: string;
  referenteEmail?: string;
  validadoPorNombre?: string;
  profileImageKey?: string | null;
  bannerKey?: string | null;
  aceptaDonaciones?: boolean;
  sitioWebUrl?: string | null;
  donacionDirectaUrl?: string | null;
}

// ─── Necesidad ─────────────────────────────────────────────────────────────────

export interface Necesidad {
  id: number;
  descripcion: string;
  prioridad: 'URGENTE' | 'MEDIA' | 'NORMAL';
  estado: string;
  fechaPublicacion: string;
  fechaVencimiento?: string;
  organizacionId: number;
}

// ─── Donacion ──────────────────────────────────────────────────────────────────

export interface Donacion {
  id: number;
  fechaOferta: string;
  fechaEntrega?: string;
  estado: 'OFRECIDA' | 'EN_CAMINO' | 'ENTREGADA' | 'CANCELADA';
  observaciones?: string;
  donanteName: string;
  necesidadId: number;
  organizacionId: number;
}

// ─── API envelope (paginated responses) ───────────────────────────────────────

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}
