import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';

export function useMisDonaciones() {
  return useQuery<Donacion[]>({
    queryKey: ['donaciones', 'mias'],
    queryFn: () => api.get<Donacion[]>('/donaciones/mias').then((r) => r.data),
  });
}
