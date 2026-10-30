import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { OrganizacionAdmin } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export interface OrganizacionesAdminParams extends PageParams {
  /** Only organizaciones with no referente. */
  sinReferente?: boolean;
  /** Only organizaciones of these referentes (the MS accepts up to 100). */
  referenteIds?: number[];
  /** Case-insensitive "name contains". */
  q?: string;
}

/** Admin-only paged listing of organizaciones regardless of estado, filterable by referente / name.
 * Powers the referente↔organización assignment panel (/referentes). */
export function useOrganizacionesAdmin(params: OrganizacionesAdminParams, options?: { enabled?: boolean }) {
  const { referenteIds, q, sinReferente, ...paging } = params;
  const query = {
    ...paging,
    ...(sinReferente ? { sinReferente: true } : {}),
    // Comma-joined: axios would otherwise serialize an array as `referenteIds[]=1&…`.
    ...(referenteIds?.length ? { referenteIds: referenteIds.join(',') } : {}),
    ...(q ? { q } : {}),
  };
  return useQuery<PageData<OrganizacionAdmin>>({
    queryKey: ['organizaciones', 'admin', query],
    queryFn: () => api.get<PageData<OrganizacionAdmin>>('/organizaciones/todas', { params: query }).then((r) => r.data),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
