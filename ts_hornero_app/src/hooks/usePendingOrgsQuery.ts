import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchPendingOrgs } from '@/lib/api/organizaciones';
import type { PageData } from '@/types/api';
import type { OrganizacionResponse } from '@/lib/api/organizaciones';

export function usePendingOrgsQuery(page = 0, size = 20) {
  return useQuery<PageData<OrganizacionResponse>>({
    queryKey: ['pendingOrgs', page, size],
    queryFn: () => fetchPendingOrgs({ page, size }),
    placeholderData: keepPreviousData,
  });
}
