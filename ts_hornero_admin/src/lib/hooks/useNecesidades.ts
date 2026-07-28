import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad } from '../../types/domain';

export function useNecesidades() {
  return useQuery<Necesidad[]>({
    queryKey: ['necesidades'],
    queryFn: () => api.get<Necesidad[]>('/necesidades').then((r) => r.data),
  });
}
