'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchValidatedOrganizaciones } from '@/lib/api/organizaciones';

export function useValidatedOrganizaciones() {
  return useQuery({
    queryKey: ['organizaciones', 'validated'],
    queryFn: fetchValidatedOrganizaciones,
    staleTime: 60_000,
  });
}
