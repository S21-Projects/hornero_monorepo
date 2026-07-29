import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Organizacion } from '../../types/domain';

interface UseMisOrganizacionesOptions {
  enabled?: boolean;
}

/**
 * Organizaciones owned by the authenticated referente. A referente can own
 * 0..3 organizaciones (see referente-organizacion-assignment spec), so this
 * always resolves to an array — never a single object, never a 404.
 */
export function useMisOrganizaciones(options: UseMisOrganizacionesOptions = {}) {
  const { enabled = true } = options;

  return useQuery<Organizacion[]>({
    queryKey: ['organizaciones', 'mias'],
    queryFn: () => api.get<Organizacion[]>('/organizaciones/mia').then((r) => r.data),
    enabled,
    // Stale immediately so navigating back to /needs still shows fresh data,
    // but the in-memory cache is shared — AuthInitializer and NeedsPage deduplicate.
    staleTime: 0,
    retry: false,
  });
}
