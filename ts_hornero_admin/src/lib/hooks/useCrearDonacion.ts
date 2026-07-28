import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion, CrearDonacionInput } from '../../types/domain';

export function useCrearDonacion() {
  const queryClient = useQueryClient();

  return useMutation<Donacion, Error, CrearDonacionInput>({
    mutationFn: (input) =>
      api.post<Donacion>('/donaciones', input).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['donaciones', 'mias'] });
    },
  });
}
