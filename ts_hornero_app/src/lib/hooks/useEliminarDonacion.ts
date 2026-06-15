'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export function useEliminarDonacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.delete(`/donaciones/${id}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donaciones'] });
      queryClient.invalidateQueries({ queryKey: ['necesidades'] });
    },
  });
}
