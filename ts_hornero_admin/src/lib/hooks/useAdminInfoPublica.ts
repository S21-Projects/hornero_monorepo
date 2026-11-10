import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { OrganizacionAdmin } from '../../types/domain';
import type { ActualizarInfoPublicaInput } from './useActualizarInfoPublica';

interface ActualizarVariables {
  organizacionId: number;
  input: ActualizarInfoPublicaInput;
}

/**
 * Admin-only info-pública mutations: direct edit (live immediately, no
 * pending snapshot), approve, and reject a referente's pending submission.
 * All three invalidate `['organizaciones']` (covers 'todas'/'pendientes').
 */
export function useAdminInfoPublica() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['organizaciones'] });
  };

  const actualizar = useMutation<OrganizacionAdmin, Error, ActualizarVariables>({
    mutationFn: ({ organizacionId, input }) =>
      api
        .patch<OrganizacionAdmin>(`/organizaciones/${organizacionId}/info-publica`, input)
        .then((r) => r.data),
    onSuccess: invalidate,
  });

  const aprobar = useMutation<OrganizacionAdmin, Error, number>({
    mutationFn: (organizacionId) =>
      api
        .patch<OrganizacionAdmin>(`/organizaciones/${organizacionId}/info-publica/aprobar`, {})
        .then((r) => r.data),
    onSuccess: invalidate,
  });

  const rechazar = useMutation<OrganizacionAdmin, Error, number>({
    mutationFn: (organizacionId) =>
      api
        .patch<OrganizacionAdmin>(`/organizaciones/${organizacionId}/info-publica/rechazar`, {})
        .then((r) => r.data),
    onSuccess: invalidate,
  });

  return { actualizar, aprobar, rechazar };
}
