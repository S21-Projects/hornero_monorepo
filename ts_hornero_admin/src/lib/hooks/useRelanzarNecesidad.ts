import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import { idempotencyHeaders, useIdempotencyKey } from '../idempotency';
import type { Necesidad, RelanzarNecesidadInput } from '../../types/domain';

interface RelanzarNecesidadVariables extends RelanzarNecesidadInput {
  id: number;
}

export function useRelanzarNecesidad(orgId: number) {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyKey();

  return useMutation<Necesidad, Error, RelanzarNecesidadVariables>({
    mutationFn: ({ id, ...input }) =>
      idempotency.run({ id, ...input }, (key) =>
        api
          .post<Necesidad>(`/necesidades/${id}/relanzar`, input, { headers: idempotencyHeaders(key) })
          .then((r) => r.data),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['necesidades', 'org', orgId] });
    },
  });
}
