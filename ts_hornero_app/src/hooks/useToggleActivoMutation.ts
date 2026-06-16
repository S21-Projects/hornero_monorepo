import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toggleActivo } from '@/lib/api/usuarios';

export function useToggleActivoMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) =>
      toggleActivo(id, activo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
  });
}
