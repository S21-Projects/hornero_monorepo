import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { OrganizacionAdmin } from '../../types/domain';

interface AsignarReferenteVariables {
  organizacionId: number;
  /** null = unassign (referente_id -> NULL). */
  referenteId: number | null;
}

/** Admin-only reassignment mutation. Invalidates both organización lists
 * (['organizaciones'], covers 'todas'/'pendientes'/'mias') and ['usuarios']
 * since the assignment view derives its referente grouping from both. */
export function useAsignarReferente() {
  const queryClient = useQueryClient();

  return useMutation<OrganizacionAdmin, Error, AsignarReferenteVariables>({
    mutationFn: ({ organizacionId, referenteId }) =>
      api
        .patch<OrganizacionAdmin>(`/organizaciones/${organizacionId}/referente`, { referenteId })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizaciones'] });
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}
