import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Usuario } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export function useUsuarios(params?: PageParams) {
  return useQuery<PageData<Usuario>>({
    queryKey: ['usuarios', params ?? {}],
    queryFn: () => api.get<PageData<Usuario>>('/usuarios', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
