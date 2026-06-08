import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { getMiOrganizacion, type OrganizacionResponse } from '@/lib/api/organizaciones';
import { useAuthStore } from '@/store/auth.store';

export function useMyOrgQuery() {
  const user = useAuthStore((s) => s.user);

  return useQuery<OrganizacionResponse | null, Error>({
    queryKey: ['myOrg'],
    queryFn: async () => {
      try {
        return await getMiOrganizacion();
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!user && user.tipo === 'REFERENTE',
    staleTime: 5 * 60 * 1000,
  });
}
