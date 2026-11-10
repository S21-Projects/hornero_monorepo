import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';

/** DONANTE-only: cancel a donation that is still OFRECIDA, ACEPTADA or EN_CAMINO. */
export function useCancelarDonacion() {
  const queryClient = useQueryClient();

  return useMutation<Donacion, Error, number>({
    mutationFn: (id) =>
      api.patch<Donacion>(`/donaciones/${id}/estado`, { estado: 'CANCELADA' }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donaciones'] });
    },
  });
}
