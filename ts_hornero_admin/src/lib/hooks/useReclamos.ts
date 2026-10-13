import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import { idempotencyHeaders, useIdempotencyKey } from '../idempotency';
import type { CrearReclamoInput, OrganizacionAdmin, Reclamo } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

/**
 * Thin TanStack Query wrappers over the BFF's `ReclamosController`
 * (`ts_hornero_bff/src/reclamos/reclamos.controller.ts`, no `/api` prefix). Roles are enforced
 * server-side (REFERENTE submits and reads their own, ADMINISTRADOR resolves).
 */

/** Public lookup of the organizacion being claimed (the claim route carries its slug). */
export function useOrganizacionPorSlug(slug: string | undefined) {
  return useQuery<OrganizacionAdmin>({
    queryKey: ['organizaciones', 'slug', slug],
    queryFn: () => api.get<OrganizacionAdmin>(`/organizaciones/${slug}`).then((r) => r.data),
    enabled: !!slug,
    retry: false,
  });
}

export function useMisReclamos() {
  return useQuery<Reclamo[]>({
    queryKey: ['reclamos', 'mios'],
    queryFn: () => api.get<Reclamo[]>('/reclamos/mios').then((r) => r.data),
  });
}

export function useReclamosPendientes(params?: PageParams) {
  return useQuery<PageData<Reclamo>>({
    queryKey: ['reclamos', 'pendientes', params ?? {}],
    queryFn: () =>
      api.get<PageData<Reclamo>>('/reclamos/pendientes', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}

export function useReclamo(id: number | undefined) {
  return useQuery<Reclamo>({
    queryKey: ['reclamos', 'detalle', id],
    queryFn: () => api.get<Reclamo>(`/reclamos/${id}`).then((r) => r.data),
    enabled: id != null,
  });
}

export function useCrearReclamo() {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyKey();

  return useMutation<Reclamo, Error, CrearReclamoInput>({
    mutationFn: (input) =>
      idempotency.run(input, (key) =>
        api
          .post<Reclamo>('/reclamos', input, { headers: idempotencyHeaders(key) })
          .then((r) => r.data),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reclamos'] });
    },
  });
}

/** An approval changes the organizacion's owner and estado, so the org lists refresh too. */
function invalidarTrasResolver(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['reclamos'] });
  void queryClient.invalidateQueries({ queryKey: ['organizaciones'] });
}

export function useAprobarReclamo() {
  const queryClient = useQueryClient();
  return useMutation<Reclamo, Error, { id: number }>({
    mutationFn: ({ id }) => api.patch<Reclamo>(`/reclamos/${id}/aprobar`, {}).then((r) => r.data),
    onSuccess: () => invalidarTrasResolver(queryClient),
  });
}

export function useRechazarReclamo() {
  const queryClient = useQueryClient();
  return useMutation<Reclamo, Error, { id: number; motivo: string }>({
    mutationFn: ({ id, motivo }) =>
      api.patch<Reclamo>(`/reclamos/${id}/rechazar`, { motivo }).then((r) => r.data),
    onSuccess: () => invalidarTrasResolver(queryClient),
  });
}
