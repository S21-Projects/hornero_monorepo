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
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'SIN_RECLAMAR' | 'INACTIVA';
  origen?: 'PLATAFORMA' | 'RENACOM';
  asistentesDeclarados?: number | null;
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

/** Item of `GET /organizaciones/mapa` (MS `OrganizacionMapaResponse`): lightweight map pin. */
export interface OrgMapa {
  id: number;
  slug: string;
  nombre: string;
  tipo: TipoOrganizacion;
  estado: 'APROBADA' | 'SIN_RECLAMAR';
  origen: 'PLATAFORMA' | 'RENACOM';
  latitud: number;
  longitud: number;
  /** Open, uncovered necesidades (ABIERTA or EN_PROGRESO, not expired). 0 for unclaimed orgs. */
  necesidadesAbiertas: number;
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
  /** Null unless the viewer is allowed to see the donor (D5); the MS masks it for the public. */
  donanteName: string | null;
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
