import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { OrganizacionAdmin } from '../../types/domain';

export function useOrganizacionesPendientes() {
  return useQuery<OrganizacionAdmin[]>({
    queryKey: ['organizaciones', 'pendientes'],
    queryFn: () =>
      api.get<OrganizacionAdmin[]>('/organizaciones/pendientes').then((r) => r.data),
  });
}
