'use client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchNecesidades } from '@/lib/api/donaciones.server';
import type { PageData } from '@/types/api';
import type { NecesidadResponse } from '@/lib/api/donaciones.server';

export function useNecesidades(page = 0, size = 20) {
  return useQuery<PageData<NecesidadResponse>>({
    queryKey: ['necesidades', 'all', page, size],
    queryFn: () => fetchNecesidades({ page, size }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
