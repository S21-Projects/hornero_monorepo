'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchOrganizaciones } from '@/lib/api/organizaciones';
import type { PageData } from '@/types/api';
import type { OrganizacionResponse } from '@/lib/api/organizaciones';

export function useOrganizacionesInfinite(size = 20) {
  return useInfiniteQuery<PageData<OrganizacionResponse>>({
    queryKey: ['organizaciones', 'infinite', size],
    queryFn: ({ pageParam }) => fetchOrganizaciones({ page: pageParam as number, size }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.number + 1 < lastPage.totalPages ? lastPage.number + 1 : undefined,
  });
}
