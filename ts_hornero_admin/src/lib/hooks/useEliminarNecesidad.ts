import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';

export function useEliminarNecesidad(orgId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: (id) => api.delete(`/necesidades/${id}`).then(() => undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['necesidades', 'org', orgId] });
    },
  });
}
