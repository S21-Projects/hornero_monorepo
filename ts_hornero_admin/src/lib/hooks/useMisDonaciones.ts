import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export function useMisDonaciones(params?: PageParams) {
  return useQuery<PageData<Donacion>>({
    queryKey: ['donaciones', 'mias', params ?? {}],
    queryFn: () => api.get<PageData<Donacion>>('/donaciones/mias', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
