import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Organizacion } from '../../types/domain';

interface UseMiOrganizacionOptions {
  enabled?: boolean;
}

export function useMiOrganizacion(options: UseMiOrganizacionOptions = {}) {
  const { enabled = true } = options;

  return useQuery<Organizacion>({
    queryKey: ['organizaciones', 'mia'],
    queryFn: () => api.get<Organizacion>('/organizaciones/mia').then((r) => r.data),
    enabled,
    // Stale immediately so navigating back to /needs still shows fresh data,
    // but the in-memory cache is shared — AuthInitializer and NeedsPage deduplicate.
    staleTime: 0,
    retry: false,
  });
}
