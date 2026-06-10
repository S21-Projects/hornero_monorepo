'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchAllNecesidades } from '@/lib/api/donaciones.server';

export function useNecesidades() {
  return useQuery({
    queryKey: ['necesidades', 'all'],
    queryFn: fetchAllNecesidades,
    staleTime: 60_000,
  });
}
