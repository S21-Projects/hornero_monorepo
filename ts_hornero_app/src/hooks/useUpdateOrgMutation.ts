import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateOrganizacion,
  type UpdateOrganizacionPayload,
  type OrganizacionResponse,
} from '@/lib/api/organizaciones';

interface UpdateOrgVariables {
  id: number;
  payload: UpdateOrganizacionPayload;
}

export function useUpdateOrgMutation() {
  const queryClient = useQueryClient();

  return useMutation<OrganizacionResponse, Error, UpdateOrgVariables>({
    mutationFn: ({ id, payload }) => updateOrganizacion(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myOrg'] });
    },
  });
}
