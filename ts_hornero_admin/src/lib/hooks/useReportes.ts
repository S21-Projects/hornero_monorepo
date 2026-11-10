import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import { idempotencyHeaders, useIdempotencyKey } from '../idempotency';
import type { CrearReporteInput, OrganizacionCercana, Reporte } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

/**
 * Thin TanStack Query wrappers over the BFF's `ReportesController`
 * (`ts_hornero_bff/src/reportes/reportes.controller.ts`, no `/api` prefix). Any authenticated role
 * submits and queries nearby organizaciones; ADMINISTRADOR lists and resolves (enforced server-side).
 */

/** Hornero organizaciones within 500 m of the reported comedor, for the duplicate picker. */
export function useOrganizacionesCercanas(organizacionId: number | undefined, enabled: boolean) {
  return useQuery<OrganizacionCercana[]>({
    queryKey: ['reportes', 'cercanas', organizacionId],
    queryFn: () =>
      api
        .get<OrganizacionCercana[]>('/reportes/cercanas', { params: { organizacionId } })
        .then((r) => r.data),
    enabled: enabled && organizacionId != null,
    retry: false,
  });
}

export function useCrearReporte() {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyKey();

  return useMutation<Reporte, Error, CrearReporteInput>({
    mutationFn: (input) =>
      idempotency.run(input, (key) =>
        api
          .post<Reporte>('/reportes', input, { headers: idempotencyHeaders(key) })
          .then((r) => r.data),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reportes'] });
    },
  });
}

export function useReportesPendientes(params?: PageParams) {
  return useQuery<PageData<Reporte>>({
    queryKey: ['reportes', 'pendientes', params ?? {}],
    queryFn: () =>
      api.get<PageData<Reporte>>('/reportes/pendientes', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function useReporte(id: number | undefined) {
  return useQuery<Reporte>({
    queryKey: ['reportes', 'detalle', id],
    queryFn: () => api.get<Reporte>(`/reportes/${id}`).then((r) => r.data),
    enabled: id != null,
  });
}

/** Marking a comedor inactive changes its estado, so the org lists and the map refresh too. */
function invalidarTrasResolver(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['reportes'] });
  void queryClient.invalidateQueries({ queryKey: ['organizaciones'] });
}

export function useMarcarInactiva() {
  const queryClient = useQueryClient();
  return useMutation<Reporte, Error, { id: number }>({
    mutationFn: ({ id }) =>
      api.patch<Reporte>(`/reportes/${id}/marcar-inactiva`, {}).then((r) => r.data),
    onSuccess: () => invalidarTrasResolver(queryClient),
  });
}

export function useDescartarReporte() {
  const queryClient = useQueryClient();
  return useMutation<Reporte, Error, { id: number; nota: string }>({
    mutationFn: ({ id, nota }) =>
      api.patch<Reporte>(`/reportes/${id}/descartar`, { nota }).then((r) => r.data),
    onSuccess: () => invalidarTrasResolver(queryClient),
  });
}
