import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad, CrearNecesidadInput } from '../../types/domain';

export function useCrearNecesidad(orgId: number) {
  const queryClient = useQueryClient();

  return useMutation<Necesidad, Error, CrearNecesidadInput>({
    // organizacionId is now required by the MS/BFF (a referente may own >1 org),
    // so it always travels with the request body, not just as a query key.
    mutationFn: (input) =>
      api.post<Necesidad>('/necesidades', { ...input, organizacionId: orgId }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['necesidades', 'org', orgId] });
    },
  });
}
