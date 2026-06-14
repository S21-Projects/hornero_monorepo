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
export type DonacionUIStatus = 'transit' | 'delivered' | 'received';

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

export function mapEstadoDonacion(estado: string): DonacionUIStatus {
  const map: Record<string, DonacionUIStatus> = {
    EN_CAMINO: 'transit',
    ENTREGADA: 'delivered',
    OFRECIDA: 'received',
    CANCELADA: 'delivered',
  };
  return map[estado] ?? 'received';
}

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
