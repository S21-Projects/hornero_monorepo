import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';

export interface DecidirDonacionInput {
  id: number;
  estado: 'ACEPTADA' | 'RECHAZADA';
}

/** REFERENTE-only: accept or reject a donation currently OFRECIDA. */
export function useDecidirDonacion() {
  const queryClient = useQueryClient();

  return useMutation<Donacion, Error, DecidirDonacionInput>({
    mutationFn: ({ id, estado }) =>
      api.patch<Donacion>(`/donaciones/${id}/decision`, { estado }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donaciones'] });
    },
  });
}
