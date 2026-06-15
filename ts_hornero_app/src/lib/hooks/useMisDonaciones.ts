'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchMisDonaciones } from '@/lib/api/donaciones.server';

export function useMisDonaciones(enabled = true) {
  return useQuery({
    queryKey: ['donaciones', 'mias'],
    queryFn: fetchMisDonaciones,
    enabled,
    staleTime: 30_000,
  });
}
