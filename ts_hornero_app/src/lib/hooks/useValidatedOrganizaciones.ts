'use client';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchOrganizaciones } from '@/lib/api/organizaciones';
import type { PageData } from '@/types/api';
import type { OrganizacionResponse } from '@/lib/api/organizaciones';

export function useValidatedOrganizaciones(page = 0, size = 20) {
  return useQuery<PageData<OrganizacionResponse>>({
    queryKey: ['organizaciones', 'validated', page, size],
    queryFn: () => fetchOrganizaciones({ page, size }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
