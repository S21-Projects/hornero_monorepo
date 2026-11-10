import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export function useNecesidades(params?: PageParams) {
  return useQuery<PageData<Necesidad>>({
    queryKey: ['necesidades', params ?? {}],
    queryFn: () => api.get<PageData<Necesidad>>('/necesidades', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
