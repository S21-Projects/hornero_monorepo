import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import { idempotencyHeaders, useIdempotencyKey } from '../idempotency';
import type { Usuario } from '../../types/domain';

/**
 * `POST /usuarios/:id/anonimizar` (ADMINISTRADOR only, N15/D12). Irreversible: the account keeps
 * its row but loses name, email and password, and its sessions are revoked.
 */
export function useAnonimizarUsuario() {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyKey();

  return useMutation<Usuario, Error, number>({
    mutationFn: (id) =>
      idempotency.run(id, (key) =>
        api
          .post<Usuario>(`/usuarios/${id}/anonimizar`, undefined, { headers: idempotencyHeaders(key) })
          .then((r) => r.data),
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}
