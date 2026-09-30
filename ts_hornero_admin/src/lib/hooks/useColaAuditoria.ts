import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type {
  NivelAcreditacion,
  RequisitoAcreditacion,
  TabCola,
  TipoEvidencia,
  EvidenciaEnColaResponse,
} from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export interface ColaAuditoriaParams extends PageParams {
  tab?: TabCola;
  nivel?: NivelAcreditacion;
  requisito?: RequisitoAcreditacion;
  tipoEvidencia?: TipoEvidencia;
}

/**
 * AD-8, `specs/auditoria-cola-global/spec.md`: the cross-org audit queue
 * (`GET auditoria/evidencias`, ADMINISTRADOR-only server-side). The BFF forwards every param
 * raw, so this hook adds no client-side validation either. `keepPreviousData` avoids a loading
 * flash on tab/filter/page changes; the query key includes every param so each combination
 * caches independently.
 */
export function useColaAuditoria(params?: ColaAuditoriaParams) {
  return useQuery<PageData<EvidenciaEnColaResponse>>({
    queryKey: ['auditoria', 'cola', params ?? {}],
    queryFn: () =>
      api
        .get<PageData<EvidenciaEnColaResponse>>('/auditoria/evidencias', { params })
        .then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
