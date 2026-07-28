import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad, CrearNecesidadInput } from '../../types/domain';

export function useCrearNecesidad(orgId: number) {
  const queryClient = useQueryClient();

  return useMutation<Necesidad, Error, CrearNecesidadInput>({
    mutationFn: (input) =>
      api.post<Necesidad>('/necesidades', input).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['necesidades', 'org', orgId] });
    },
  });
}
