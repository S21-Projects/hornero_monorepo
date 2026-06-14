import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rejectOrganizacion } from '@/lib/api/organizaciones';

export function useRejectOrgMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (id: number) => rejectOrganizacion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingOrgs'] });
    },
  });
}
