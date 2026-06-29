import { publicFetch } from '@/lib/publicFetch';
import { api } from '@/lib/axios';
import type { PageData, PageParams } from '@/types/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NecesidadResponse {
  id: number;
  descripcion: string;
  prioridad: string;
  estado: string;
  fechaPublicacion: string;
  fechaVencimiento?: string;
  organizacionId: number;
}

export interface DonacionResponse {
  id: number;
  fechaOferta: string;
  fechaEntrega?: string;
  estado: string;
  observaciones?: string;
  donanteName: string;
  necesidadId: number;
  organizacionId: number;
  necesidadDescripcion: string;
  organizacionNombre: string;
}

// ─── UI token types ────────────────────────────────────────────────────────────

export type NecesidadUIPriority = 'urgent' | 'medium' | 'normal';

// ─── Enum maps ────────────────────────────────────────────────────────────────

export const PRIORITY_ORDER: Record<NecesidadUIPriority, number> = {
  urgent: 0,
  medium: 1,
  normal: 2,
};

export function mapPrioridad(prioridad: string): NecesidadUIPriority {
  const map: Record<string, NecesidadUIPriority> = {
    URGENTE: 'urgent',
    MEDIA: 'medium',
    NORMAL: 'normal',
  };
  return map[prioridad] ?? 'normal';
}

// Estado labels/colors for donation states. Distinguishes all four EstadoDonacion
// values (OFRECIDA / EN_CAMINO / ENTREGADA / CANCELADA).
export const ESTADO_DONACION_LABELS: Record<string, string> = {
  OFRECIDA: 'Ofrecida',
  EN_CAMINO: 'En camino',
  ENTREGADA: 'Entregada',
  CANCELADA: 'Cancelada',
};

export const ESTADO_DONACION_PILL: Record<string, 'warn' | 'open' | 'ok' | 'bad'> = {
  OFRECIDA: 'warn',
  EN_CAMINO: 'open',
  ENTREGADA: 'ok',
  CANCELADA: 'bad',
};

// ─── Fetchers ─────────────────────────────────────────────────────────────────

// ─── Paginated fetchers ───────────────────────────────────────────────────────

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchNecesidades(
  params: PageParams & { organizacionId?: string } = {}
): Promise<PageData<NecesidadResponse>> {
  const qs = buildQueryString({
    page: params.page,
    size: params.size,
    sort: params.sort,
    organizacionId: params.organizacionId,
  });
  const { data } = await api.get<PageData<NecesidadResponse>>(`/necesidades${qs}`);
  return data;
}

export async function fetchDonaciones(params: PageParams = {}): Promise<PageData<DonacionResponse>> {
  const qs = buildQueryString({ page: params.page, size: params.size, sort: params.sort });
  const { data } = await api.get<PageData<DonacionResponse>>(`/donaciones${qs}`);
  return data;
}

export async function fetchMisDonaciones(params: PageParams = {}): Promise<PageData<DonacionResponse>> {
  const qs = buildQueryString({ page: params.page, size: params.size, sort: params.sort });
  const { data } = await api.get<PageData<DonacionResponse>>(`/donaciones/mias${qs}`);
  return data;
}

// ─── Legacy server-side fetchers (publicFetch / org page) ────────────────────

export async function getNecesidadesByOrg(orgId: number): Promise<NecesidadResponse[]> {
  return publicFetch<NecesidadResponse[]>(`/necesidades?organizacionId=${orgId}`, {
    revalidate: 60,
  });
}

export async function getDonacionesByOrg(orgId: number): Promise<DonacionResponse[]> {
  return publicFetch<DonacionResponse[]>(`/donaciones?organizacionId=${orgId}`, {
    revalidate: 60,
  });
}

// ─── Client-side fetchers (TanStack Query) ────────────────────────────────────

/** @deprecated Use fetchNecesidades(params) instead */
export async function fetchAllNecesidades(): Promise<NecesidadResponse[]> {
  const { data } = await api.get<PageData<NecesidadResponse>>('/necesidades');
  return data.content;
}

/** @deprecated Use fetchDonaciones(params) instead */
export async function fetchAllDonaciones(): Promise<DonacionResponse[]> {
  const { data } = await api.get<PageData<DonacionResponse>>('/donaciones');
  return data.content;
}

export async function fetchDonacionesByOrg(orgId: number): Promise<DonacionResponse[]> {
  const { data } = await api.get<PageData<DonacionResponse>>(`/donaciones?organizacionId=${orgId}&size=100`);
  return data.content;
}

export async function fetchNecesidadesByOrg(orgId: number): Promise<NecesidadResponse[]> {
  const { data } = await api.get<PageData<NecesidadResponse>>(`/necesidades?organizacionId=${orgId}&size=100`);
  return data.content;
}
