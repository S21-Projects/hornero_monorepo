import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';

interface UseDonacionesDeMiOrgOptions {
  enabled?: boolean;
}

export function useDonacionesDeMiOrg(options: UseDonacionesDeMiOrgOptions = {}) {
  const { enabled = true } = options;

  return useQuery<Donacion[]>({
    queryKey: ['donaciones', 'mi-organizacion'],
    queryFn: () => api.get<Donacion[]>('/donaciones/mi-organizacion').then((r) => r.data),
    enabled,
    retry: false,
  });
}
