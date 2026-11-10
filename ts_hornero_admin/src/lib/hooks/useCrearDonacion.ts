import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import { idempotencyHeaders, useIdempotencyKey } from '../idempotency';
import type { Donacion, CrearDonacionInput } from '../../types/domain';

export function useCrearDonacion() {
  const queryClient = useQueryClient();

  // `CrearDonacionInput` is a union (DIRECTA vs FONDO_COMUN, `specs/donacion-fondo-comun`); the
  // BFF's `CrearDonacionDto` accepts the same body shape for both via `modalidad`.
  const idempotency = useIdempotencyKey();

  return useMutation<Donacion, Error, CrearDonacionInput>({
    mutationFn: (input) =>
      idempotency.run(input, (key) =>
        api
          .post<Donacion>('/donaciones', input, { headers: idempotencyHeaders(key) })
          .then((r) => r.data),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donaciones', 'mias'] });
    },
  });
}
