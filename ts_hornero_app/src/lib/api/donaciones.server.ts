import { publicFetch } from '@/lib/publicFetch';
import { api } from '@/lib/axios';

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

export async function fetchAllNecesidades(): Promise<NecesidadResponse[]> {
  const { data } = await api.get<NecesidadResponse[]>('/necesidades');
  return data;
}

export async function fetchAllDonaciones(): Promise<DonacionResponse[]> {
  const { data } = await api.get<DonacionResponse[]>('/donaciones');
  return data;
}

export async function fetchMisDonaciones(): Promise<DonacionResponse[]> {
  const { data } = await api.get<DonacionResponse[]>('/donaciones/mias');
  return data;
}

export async function fetchDonacionesByOrg(orgId: number): Promise<DonacionResponse[]> {
  const { data } = await api.get<DonacionResponse[]>(`/donaciones?organizacionId=${orgId}`);
  return data;
}

export async function fetchNecesidadesByOrg(orgId: number): Promise<NecesidadResponse[]> {
  const { data } = await api.get<NecesidadResponse[]>(`/necesidades?organizacionId=${orgId}`);
  return data;
}
