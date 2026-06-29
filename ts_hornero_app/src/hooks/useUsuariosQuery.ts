import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchUsuarios } from '@/lib/api/usuarios';
import type { PageData } from '@/types/api';
import type { UsuarioResponse } from '@/lib/api/usuarios';

export function useUsuariosQuery(page = 0, size = 20) {
  return useQuery<PageData<UsuarioResponse>>({
    queryKey: ['usuarios', page, size],
    queryFn: () => fetchUsuarios({ page, size }),
    placeholderData: keepPreviousData,
  });
}
