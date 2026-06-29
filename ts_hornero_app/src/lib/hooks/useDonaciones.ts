'use client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchDonaciones } from '@/lib/api/donaciones.server';
import type { PageData } from '@/types/api';
import type { DonacionResponse } from '@/lib/api/donaciones.server';

export function useDonaciones(page = 0, size = 20) {
  return useQuery<PageData<DonacionResponse>>({
    queryKey: ['donaciones', 'all', page, size],
    queryFn: () => fetchDonaciones({ page, size }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
