import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import { idempotencyHeaders, useIdempotencyKey } from '../idempotency';
import type { Organizacion, CrearOrganizacionInput } from '../../types/domain';

/**
 * Creates an organización for the authenticated referente. Shared by the
 * registration org step and the self-service "add another organización" flow
 * — both hit the same `POST /organizaciones`, which the MS caps at 3 active
 * (non-RECHAZADA) organizaciones per referente (409 on the 4th).
 */
export function useCrearOrganizacion() {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyKey();

  return useMutation<Organizacion, Error, CrearOrganizacionInput>({
    mutationFn: (input) =>
      idempotency.run(input, (key) =>
        api
          .post<Organizacion>('/organizaciones', input, { headers: idempotencyHeaders(key) })
          .then((r) => r.data),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizaciones', 'mias'] });
    },
  });
}
