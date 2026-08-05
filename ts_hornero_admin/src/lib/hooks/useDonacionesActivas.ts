import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { DonacionActiva } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export interface DonacionesActivasParams extends PageParams {
  q?: string;
  estado?: string;
}

/** ADMINISTRADOR-only: paginated non-terminal donations for `/control-donaciones`. */
export function useDonacionesActivas(params?: DonacionesActivasParams) {
  return useQuery<PageData<DonacionActiva>>({
    queryKey: ['donaciones', 'activas', params ?? {}],
    queryFn: () => api.get<PageData<DonacionActiva>>('/donaciones/activas', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
