import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';

export interface OverrideEstadoDonacionInput {
  id: number;
  estado: string;
  motivo: string;
}

/** ADMINISTRADOR-only: force a donation's estado regardless of the normal transition matrix. */
export function useOverrideEstadoDonacion() {
  const queryClient = useQueryClient();

  return useMutation<Donacion, Error, OverrideEstadoDonacionInput>({
    mutationFn: ({ id, estado, motivo }) =>
      api.patch<Donacion>(`/donaciones/${id}/estado-admin`, { estado, motivo }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donaciones'] });
    },
  });
}
