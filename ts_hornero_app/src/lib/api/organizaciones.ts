import { api } from '@/lib/axios';
import type { TipoOrganizacion } from '@/lib/tipos-organizacion';
import type { PageData, PageParams } from '@/types/api';

export interface CreateOrganizacionPayload {
  nombre: string;
  tipo: TipoOrganizacion;
  descripcion?: string;
  direccion?: string;
  latitud: number;
  longitud: number;
}

export interface OrganizacionResponse {
  id: number;
  slug: string;
  nombre: string;
  tipo: TipoOrganizacion;
  descripcion?: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  validada: boolean;
  referenteNombre?: string;
  referenteEmail?: string;
  validadoPorNombre?: string;
  profileImageKey?: string | null;
  bannerKey?: string | null;
}

export async function createOrganizacion(
  payload: CreateOrganizacionPayload
): Promise<OrganizacionResponse> {
  const { data } = await api.post<OrganizacionResponse>('/organizaciones', payload);
  return data;
}

export async function getMiOrganizacion(): Promise<OrganizacionResponse> {
  const { data } = await api.get<OrganizacionResponse>('/organizaciones/mia');
  return data;
}

export async function getPendingOrganizaciones(): Promise<OrganizacionResponse[]> {
  const { data } = await api.get<PageData<OrganizacionResponse>>('/organizaciones/pendientes?size=100');
  return data.content;
}

export async function validateOrganizacion(id: number): Promise<void> {
  await api.patch(`/organizaciones/${id}/validar`);
}

export async function rejectOrganizacion(id: number): Promise<void> {
  await api.patch(`/organizaciones/${id}/rechazar`);
}

export async function fetchValidatedOrganizaciones(): Promise<OrganizacionResponse[]> {
  const { data } = await api.get<PageData<OrganizacionResponse>>('/organizaciones?size=100');
  return data.content;
}

export async function fetchOrganizacionBySlug(slug: string): Promise<OrganizacionResponse> {
  const { data } = await api.get<OrganizacionResponse>(`/organizaciones/${slug}`);
  return data;
}

export interface UpdateOrganizacionPayload {
  nombre?: string;
  tipo?: TipoOrganizacion;
  descripcion?: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  profileImageKey?: string | null;
  bannerKey?: string | null;
}

// ─── Paginated fetchers ───────────────────────────────────────────────────────

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchOrganizaciones(params: PageParams = {}): Promise<PageData<OrganizacionResponse>> {
  const qs = buildQueryString({ page: params.page, size: params.size, sort: params.sort });
  const { data } = await api.get<PageData<OrganizacionResponse>>(`/organizaciones${qs}`);
  return data;
}

export async function fetchPendingOrgs(params: PageParams = {}): Promise<PageData<OrganizacionResponse>> {
  const qs = buildQueryString({ page: params.page, size: params.size, sort: params.sort });
  const { data } = await api.get<PageData<OrganizacionResponse>>(`/organizaciones/pendientes${qs}`);
  return data;
}

export async function updateOrganizacion(
  id: number,
  payload: UpdateOrganizacionPayload,
): Promise<OrganizacionResponse> {
  const { data } = await api.patch<OrganizacionResponse>(`/organizaciones/${id}`, payload);
  return data;
}
