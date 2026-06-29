'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchNecesidades } from '@/lib/api/donaciones.server';
import type { PageData } from '@/types/api';
import type { NecesidadResponse } from '@/lib/api/donaciones.server';

export function useNecesidadesInfinite(size = 20, organizacionId?: string) {
  return useInfiniteQuery<PageData<NecesidadResponse>>({
    queryKey: ['necesidades', 'infinite', size, organizacionId],
    queryFn: ({ pageParam }) =>
      fetchNecesidades({ page: pageParam as number, size, organizacionId }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.number + 1 < lastPage.totalPages ? lastPage.number + 1 : undefined,
  });
}
