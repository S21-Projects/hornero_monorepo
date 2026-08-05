import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Organizacion } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export function useOrganizaciones(params?: PageParams) {
  return useQuery<PageData<Organizacion>>({
    queryKey: ['organizaciones', params ?? {}],
    queryFn: () => api.get<PageData<Organizacion>>('/organizaciones', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
