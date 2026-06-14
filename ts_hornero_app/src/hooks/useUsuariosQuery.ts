import { useQuery } from '@tanstack/react-query';
import { getUsuarios, type UsuarioResponse } from '@/lib/api/usuarios';

export function useUsuariosQuery() {
  return useQuery<UsuarioResponse[], Error>({
    queryKey: ['usuarios'],
    queryFn: getUsuarios,
  });
}
