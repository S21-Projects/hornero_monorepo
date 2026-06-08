import { useQuery } from '@tanstack/react-query';
import { getPendingOrganizaciones, type OrganizacionResponse } from '@/lib/api/organizaciones';

export function usePendingOrgsQuery() {
  return useQuery<OrganizacionResponse[], Error>({
    queryKey: ['pendingOrgs'],
    queryFn: getPendingOrganizaciones,
  });
}
