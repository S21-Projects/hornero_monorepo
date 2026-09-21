import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import type {
  AcreditacionResponse,
  EvidenciaResponse,
  LegajoResponse,
  NivelAcreditacion,
  RequisitoAcreditacion,
  TipoEvidencia,
} from '../../types/domain';

/**
 * Thin TanStack Query wrappers over the BFF's `AcreditacionController`
 * (`ts_hornero_bff/src/acreditacion/acreditacion.controller.ts`) — no `/api`
 * prefix, same six routes, same `/organizaciones/{id}/...` path shape.
 * Ownership (D-01: ADMINISTRADOR or the owning REFERENTE) is enforced
 * server-side; these hooks add no client-side ownership logic.
 */

export function useAcreditacion(organizacionId: number | undefined) {
  return useQuery<AcreditacionResponse>({
    queryKey: ['acreditacion', organizacionId],
    queryFn: () =>
      api
        .get<AcreditacionResponse>(`/organizaciones/${organizacionId}/acreditacion`)
        .then((r) => r.data),
    enabled: organizacionId != null,
  });
}

export function useLegajo(organizacionId: number | undefined) {
  return useQuery<LegajoResponse>({
    queryKey: ['legajo', organizacionId],
    queryFn: () =>
      api.get<LegajoResponse>(`/organizaciones/${organizacionId}/legajo`).then((r) => r.data),
    enabled: organizacionId != null,
  });
}

/**
 * D-02 audit-queue read: the BFF proxy for `GET .../acreditacion/evidencias?estado=PENDIENTE`.
 * ADMINISTRADOR-only server-side; supplies the `evidenciaId` per requisito that `AuditQueue`
 * needs to render its approve/observe buttons (previously always `{}` — see `legajo.tsx`).
 */
export function useEvidenciasPendientes(organizacionId: number | undefined) {
  return useQuery<EvidenciaResponse[]>({
    queryKey: ['evidencias-pendientes', organizacionId],
    queryFn: () =>
      api
        .get<EvidenciaResponse[]>(
          `/organizaciones/${organizacionId}/acreditacion/evidencias?estado=PENDIENTE`,
        )
        .then((r) => r.data),
    enabled: organizacionId != null,
  });
}

export interface CargarEvidenciaInput {
  requisito: RequisitoAcreditacion;
  tipoEvidencia: TipoEvidencia;
  declaracion?: string;
  /** Only for FOTO/DOCUMENTO — the key returned by `useUploadOrgEvidencia`. */
  objectKey?: string;
  validoDesde?: string;
  validoHasta?: string;
}

interface CargarEvidenciaVariables {
  organizacionId: number;
  input: CargarEvidenciaInput;
}

export function useCargarEvidencia() {
  const queryClient = useQueryClient();

  return useMutation<EvidenciaResponse, Error, CargarEvidenciaVariables>({
    mutationFn: ({ organizacionId, input }) =>
      api
        .post<EvidenciaResponse>(`/organizaciones/${organizacionId}/acreditacion/evidencias`, input)
        .then((r) => r.data),
    onSuccess: (_data, { organizacionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['acreditacion', organizacionId] });
      void queryClient.invalidateQueries({ queryKey: ['legajo', organizacionId] });
    },
  });
}

export type AuditarEvidenciaAccion = 'aprobar' | 'observar';

interface AuditarEvidenciaVariables {
  organizacionId: number;
  evidenciaId: number;
  accion: AuditarEvidenciaAccion;
  /** Required by the service layer when accion === 'observar'; ignored for 'aprobar'. */
  observacion?: string;
}

export function useAuditarEvidencia() {
  const queryClient = useQueryClient();

  return useMutation<EvidenciaResponse, Error, AuditarEvidenciaVariables>({
    mutationFn: ({ organizacionId, evidenciaId, accion, observacion }) =>
      api
        .patch<EvidenciaResponse>(
          `/organizaciones/${organizacionId}/acreditacion/evidencias/${evidenciaId}/${accion}`,
          accion === 'observar' ? { observacion } : {},
        )
        .then((r) => r.data),
    onSuccess: (_data, { organizacionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['acreditacion', organizacionId] });
      void queryClient.invalidateQueries({ queryKey: ['legajo', organizacionId] });
    },
  });
}

interface CambiarNivelVariables {
  organizacionId: number;
  destino: NivelAcreditacion;
  motivo: string;
}

export function useCambiarNivel() {
  const queryClient = useQueryClient();

  return useMutation<AcreditacionResponse, Error, CambiarNivelVariables>({
    mutationFn: ({ organizacionId, destino, motivo }) =>
      api
        .patch<AcreditacionResponse>(`/organizaciones/${organizacionId}/acreditacion/nivel`, {
          destino,
          motivo,
        })
        .then((r) => r.data),
    onSuccess: (_data, { organizacionId }) => {
      void queryClient.invalidateQueries({ queryKey: ['acreditacion', organizacionId] });
      void queryClient.invalidateQueries({ queryKey: ['legajo', organizacionId] });
    },
  });
}
