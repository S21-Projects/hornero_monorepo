import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { OrganizacionAdmin } from '../../types/domain';

export function useRechazarOrganizacion() {
  const queryClient = useQueryClient();

  return useMutation<OrganizacionAdmin, Error, number>({
    mutationFn: (id) =>
      api.patch<OrganizacionAdmin>(`/organizaciones/${id}/rechazar`, {}).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizaciones', 'pendientes'] });
    },
  });
}
