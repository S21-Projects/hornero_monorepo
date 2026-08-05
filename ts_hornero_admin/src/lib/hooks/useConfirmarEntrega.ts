import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';

/** DONANTE or REFERENTE: confirm delivery. Idempotent on the MS side if the actor already confirmed. */
export function useConfirmarEntrega() {
  const queryClient = useQueryClient();

  return useMutation<Donacion, Error, number>({
    mutationFn: (id) =>
      api.post<Donacion>(`/donaciones/${id}/confirmar-entrega`).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donaciones'] });
    },
  });
}
