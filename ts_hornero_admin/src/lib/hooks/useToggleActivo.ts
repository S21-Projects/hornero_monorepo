import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Usuario } from '../../types/domain';

export function useToggleActivo() {
  const qc = useQueryClient();

  return useMutation<Usuario, Error, { id: number; activo: boolean; motivo?: string }, { prev?: Usuario[] }>({
    mutationFn: ({ id, activo, motivo }) =>
      api.patch<Usuario>(`/usuarios/${id}/activo`, motivo ? { activo, motivo } : { activo }).then((r) => r.data),
    onMutate: async ({ id, activo }) => {
      await qc.cancelQueries({ queryKey: ['usuarios'] });
      const prev = qc.getQueryData<Usuario[]>(['usuarios']);
      qc.setQueryData<Usuario[]>(['usuarios'], (old) =>
        old?.map((u) => (u.id === id ? { ...u, activo } : u)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['usuarios'], ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}
