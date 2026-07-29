import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Organizacion } from '../../types/domain';

export interface ActualizarInfoPublicaInput {
  aceptaDonaciones?: boolean;
  /** '' clears the field to NULL; omit the key to leave it unchanged. */
  sitioWebUrl?: string;
  donacionDirectaUrl?: string;
}

interface ActualizarInfoPublicaVariables {
  organizacionId: number;
  input: ActualizarInfoPublicaInput;
}

/**
 * Referente self-service mutation: submits a change to the three info-pública
 * fields via the existing `PATCH /organizaciones/{id}`. The MS routes this
 * through the pending-approval snapshot — the public site keeps rendering
 * the last-approved values until an admin approves the submission.
 */
export function useActualizarInfoPublica() {
  const queryClient = useQueryClient();

  return useMutation<Organizacion, Error, ActualizarInfoPublicaVariables>({
    mutationFn: ({ organizacionId, input }) =>
      api
        .patch<Organizacion>(`/organizaciones/${organizacionId}`, input)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizaciones', 'mias'] });
    },
  });
}
