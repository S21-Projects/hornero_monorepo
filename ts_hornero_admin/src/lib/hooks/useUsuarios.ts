import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Usuario } from '../../types/domain';

export function useUsuarios() {
  return useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: () => api.get<Usuario[]>('/usuarios').then((r) => r.data),
  });
}
