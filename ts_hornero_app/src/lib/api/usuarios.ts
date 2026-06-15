import { api } from '@/lib/axios';
import type { UserRole } from '@/lib/roles';

export interface UsuarioResponse {
  id: number;
  nombre: string;
  email: string;
  tipo: UserRole;
  activo: boolean;
}

export async function getUsuarios(): Promise<UsuarioResponse[]> {
  const { data } = await api.get<UsuarioResponse[]>('/usuarios');
  return data;
}

export async function toggleActivo(id: number, activo: boolean): Promise<UsuarioResponse> {
  const { data } = await api.patch<UsuarioResponse>(`/usuarios/${id}/activo`, { activo });
  return data;
}
