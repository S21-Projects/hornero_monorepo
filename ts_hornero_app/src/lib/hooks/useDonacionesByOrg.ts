'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchDonacionesByOrg } from '@/lib/api/donaciones.server';

export function useDonacionesByOrg(orgId?: number) {
  return useQuery({
    queryKey: ['donaciones', 'org', orgId],
    queryFn: () => fetchDonacionesByOrg(orgId as number),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}
