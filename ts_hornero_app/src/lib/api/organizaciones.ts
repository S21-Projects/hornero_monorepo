import { api } from '@/lib/axios';

export interface CreateOrganizacionPayload {
  nombre: string;
  tipo: string;
  descripcion?: string;
  direccion?: string;
  latitud: number;
  longitud: number;
}

export interface OrganizacionResponse {
  id: number;
  slug: string;
  nombre: string;
  tipo: string;
  descripcion?: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  validada: boolean;
  referenteNombre?: string;
  referenteEmail?: string;
  validadoPorNombre?: string;
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
  const { data } = await api.get<OrganizacionResponse[]>('/organizaciones/pendientes');
  return data;
}

export async function validateOrganizacion(id: number): Promise<void> {
  await api.patch(`/organizaciones/${id}/validar`);
}

export async function rejectOrganizacion(id: number): Promise<void> {
  await api.patch(`/organizaciones/${id}/rechazar`);
}

export async function fetchValidatedOrganizaciones(): Promise<OrganizacionResponse[]> {
  const { data } = await api.get<OrganizacionResponse[]>('/organizaciones');
  return data;
}
