import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad, ActualizarNecesidadInput } from '../../types/domain';

interface ActualizarNecesidadVariables extends ActualizarNecesidadInput {
  id: number;
}

export function useActualizarNecesidad(orgId: number) {
  const queryClient = useQueryClient();

  return useMutation<Necesidad, Error, ActualizarNecesidadVariables>({
    mutationFn: ({ id, ...input }) =>
      api.patch<Necesidad>(`/necesidades/${id}`, input).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['necesidades', 'org', orgId] });
    },
  });
}
