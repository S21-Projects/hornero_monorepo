import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Usuario } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export interface UsuariosParams extends PageParams {
  /** Only users of this type (the MS JPA discriminator). */
  tipo?: Usuario['tipo'];
  /** `true` keeps active accounts only; omit for all. */
  activo?: boolean;
  /** Case-insensitive "nombre or email contains". */
  q?: string;
}

export function useUsuarios(params?: UsuariosParams, options?: { enabled?: boolean }) {
  const { tipo, activo, q, ...paging } = params ?? {};
  const query = {
    ...paging,
    ...(tipo ? { tipo } : {}),
    ...(activo ? { activo: true } : {}),
    ...(q ? { q } : {}),
  };
  return useQuery<PageData<Usuario>>({
    queryKey: ['usuarios', query],
    queryFn: () => api.get<PageData<Usuario>>('/usuarios', { params: query }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
