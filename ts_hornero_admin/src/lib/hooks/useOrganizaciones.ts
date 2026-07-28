import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Organizacion } from '../../types/domain';

export function useOrganizaciones() {
  return useQuery<Organizacion[]>({
    queryKey: ['organizaciones'],
    queryFn: () => api.get<Organizacion[]>('/organizaciones').then((r) => r.data),
  });
}
