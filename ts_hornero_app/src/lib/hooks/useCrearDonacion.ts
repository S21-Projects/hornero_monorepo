'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface CrearDonacionPayload {
  necesidadId: number;
  observaciones?: string;
}

export function useCrearDonacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CrearDonacionPayload) =>
      api.post('/donaciones', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donaciones'] });
      queryClient.invalidateQueries({ queryKey: ['necesidades'] });
    },
  });
}
