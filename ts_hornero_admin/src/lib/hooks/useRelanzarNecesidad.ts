import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad, RelanzarNecesidadInput } from '../../types/domain';

interface RelanzarNecesidadVariables extends RelanzarNecesidadInput {
  id: number;
}

export function useRelanzarNecesidad(orgId: number) {
  const queryClient = useQueryClient();

  return useMutation<Necesidad, Error, RelanzarNecesidadVariables>({
    mutationFn: ({ id, ...input }) =>
      api.post<Necesidad>(`/necesidades/${id}/relanzar`, input).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['necesidades', 'org', orgId] });
    },
  });
}
