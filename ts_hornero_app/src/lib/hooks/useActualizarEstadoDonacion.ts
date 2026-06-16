'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface ActualizarEstadoDonacionPayload {
  id: number;
  estado: 'OFRECIDA' | 'EN_CAMINO' | 'ENTREGADA' | 'CANCELADA';
}

export function useActualizarEstadoDonacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, estado }: ActualizarEstadoDonacionPayload) =>
      api.patch(`/donaciones/${id}/estado`, { estado }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donaciones'] });
      queryClient.invalidateQueries({ queryKey: ['necesidades'] });
    },
  });
}
