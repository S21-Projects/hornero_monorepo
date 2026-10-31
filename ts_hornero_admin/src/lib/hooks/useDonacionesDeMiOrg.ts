import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

interface UseDonacionesDeMiOrgOptions extends PageParams {
  enabled?: boolean;
}

/** Donations received by the referente's organizaciones, newest first, one page at a time. */
export function useDonacionesDeMiOrg(options: UseDonacionesDeMiOrgOptions = {}) {
  const { enabled = true, ...params } = options;

  return useQuery<PageData<Donacion>>({
    queryKey: ['donaciones', 'mi-organizacion', params],
    queryFn: () =>
      api.get<PageData<Donacion>>('/donaciones/mi-organizacion', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled,
    retry: false,
  });
}
