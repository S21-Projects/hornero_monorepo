import { api } from '@/lib/axios';
import type { UserRole } from '@/lib/roles';
import type { PageData, PageParams } from '@/types/api';

export interface UsuarioResponse {
  id: number;
  nombre: string;
  email: string;
  tipo: UserRole;
  activo: boolean;
}

export async function getUsuarios(): Promise<UsuarioResponse[]> {
  const { data } = await api.get<PageData<UsuarioResponse>>('/usuarios?size=100');
  return data.content;
}

export async function fetchUsuarios(params: PageParams = {}): Promise<PageData<UsuarioResponse>> {
  const q = new URLSearchParams();
  if (params.page !== undefined) q.set('page', String(params.page));
  if (params.size !== undefined) q.set('size', String(params.size));
  if (params.sort) q.set('sort', params.sort);
  const qs = q.toString() ? `?${q}` : '';
  const { data } = await api.get<PageData<UsuarioResponse>>(`/usuarios${qs}`);
  return data;
}

export async function toggleActivo(id: number, activo: boolean): Promise<UsuarioResponse> {
  const { data } = await api.patch<UsuarioResponse>(`/usuarios/${id}/activo`, { activo });
  return data;
}
