import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { OrganizacionAdmin } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export function useOrganizacionesPendientes(params?: PageParams, options?: { enabled?: boolean }) {
  return useQuery<PageData<OrganizacionAdmin>>({
    queryKey: ['organizaciones', 'pendientes', params ?? {}],
    queryFn: () =>
      api.get<PageData<OrganizacionAdmin>>('/organizaciones/pendientes', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
