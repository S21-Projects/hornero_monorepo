import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad } from '../../types/domain';

export function useNecesidad(id: number | undefined) {
  return useQuery<Necesidad>({
    queryKey: ['necesidades', id],
    queryFn: () => api.get<Necesidad>(`/necesidades/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}
