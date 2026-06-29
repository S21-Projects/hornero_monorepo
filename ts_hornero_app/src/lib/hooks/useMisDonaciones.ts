'use client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchMisDonaciones } from '@/lib/api/donaciones.server';
import type { PageData } from '@/types/api';
import type { DonacionResponse } from '@/lib/api/donaciones.server';

export function useMisDonaciones(page = 0, size = 20, enabled = true) {
  return useQuery<PageData<DonacionResponse>>({
    queryKey: ['donaciones', 'mias', page, size],
    queryFn: () => fetchMisDonaciones({ page, size }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
