import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Necesidad } from '../../types/domain';

export function useNecesidadesDeOrg(orgId: number | null | undefined) {
  return useQuery<Necesidad[]>({
    queryKey: ['necesidades', 'org', orgId],
    queryFn: () =>
      api
        .get<Necesidad[]>('/necesidades', { params: { organizacionId: orgId } })
        .then((r) => r.data),
    enabled: orgId != null,
  });
}
