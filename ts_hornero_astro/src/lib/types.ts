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

/** Mirrors MS `NecesidadResponse`'s `articulos` component (feature catalogo-articulos, decision 6). */
export interface NecesidadArticulo {
  id: number;
  nombre: string;
  unidad: 'KG' | 'PAQUETE' | 'LITRO' | 'UNIDAD';
  categoria: 'NO_PERECEDERO' | 'REFRIGERADO' | 'CONGELADO';
}

export interface Necesidad {
  id: number;
  descripcion: string;
  prioridad: 'URGENTE' | 'MEDIA' | 'NORMAL';
  estado: string;
  fechaPublicacion: string;
  fechaVencimiento?: string;
  organizacionId: number;
  /** Requested articulos (feature catalogo-articulos, decision 6). Absent on pre-catalog
   * responses. */
  articulos?: NecesidadArticulo[];
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

// ─── Paginated response (mirrors MS `PageData.java`) ──────────────────────────

export interface PageData<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
