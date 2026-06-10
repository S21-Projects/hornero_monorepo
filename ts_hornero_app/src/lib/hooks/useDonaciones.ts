'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchAllDonaciones } from '@/lib/api/donaciones.server';

export function useDonaciones() {
  return useQuery({
    queryKey: ['donaciones', 'all'],
    queryFn: fetchAllDonaciones,
    staleTime: 60_000,
  });
}
