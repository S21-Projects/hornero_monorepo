import { useMutation, useQueryClient } from '@tanstack/react-query';
import { validateOrganizacion } from '@/lib/api/organizaciones';

export function useValidateOrgMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (id: number) => validateOrganizacion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingOrgs'] });
    },
  });
}
