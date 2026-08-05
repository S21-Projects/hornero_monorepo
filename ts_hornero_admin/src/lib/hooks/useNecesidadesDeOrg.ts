import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export function useNecesidadesDeOrg(orgId: number | null | undefined, params?: PageParams) {
  return useQuery<PageData<Necesidad>>({
    queryKey: ['necesidades', 'org', orgId, params ?? {}],
    queryFn: () =>
      api
        .get<PageData<Necesidad>>('/necesidades', { params: { ...params, organizacionId: orgId } })
        .then((r) => r.data),
    enabled: orgId != null,
    placeholderData: keepPreviousData,
  });
}
