import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { OrganizacionAdmin } from '../../types/domain';

/** Admin-only: every organización regardless of estado/referente. Powers the
 * referente↔organización assignment panel (/referentes). */
export function useTodasOrganizaciones() {
  return useQuery<OrganizacionAdmin[]>({
    queryKey: ['organizaciones', 'todas'],
    queryFn: () => api.get<OrganizacionAdmin[]>('/organizaciones/todas').then((r) => r.data),
  });
}
