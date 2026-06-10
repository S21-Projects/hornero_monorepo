'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface CreateNecesidadPayload {
  descripcion: string;
  prioridad: string;
  fechaVencimiento?: string;
}

export function useCreateNecesidad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateNecesidadPayload) =>
      api.post('/necesidades', payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['necesidades'] });
    },
  });
}
