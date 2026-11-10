import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

interface UseDonacionesDeMiOrgOptions extends PageParams {
  /** Keep only donations in these estados (server-side, so pagination cannot hide them). */
  estado?: string[];
  enabled?: boolean;
}

/** Donations received by the referente's organizaciones, newest first, one page at a time. */
export function useDonacionesDeMiOrg(options: UseDonacionesDeMiOrgOptions = {}) {
  const { enabled = true, estado, ...paging } = options;
  // Comma-joined: axios would otherwise serialize an array as `estado[]=A&estado[]=B`.
  const params = { ...paging, ...(estado?.length ? { estado: estado.join(',') } : {}) };

  return useQuery<PageData<Donacion>>({
    queryKey: ['donaciones', 'mi-organizacion', params],
    queryFn: () =>
      api.get<PageData<Donacion>>('/donaciones/mi-organizacion', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled,
    retry: false,
  });
}
