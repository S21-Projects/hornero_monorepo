import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import { idempotencyHeaders, useIdempotencyKey } from '../idempotency';
import type { AsignacionRonda, RondaFondoResponse, RondaResponse } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

const FONDO_KEY = ['rondas', 'fondo'] as const;
const HISTORIAL_KEY = (params?: PageParams) => ['rondas', 'historial', params ?? {}] as const;

/**
 * Pool size and the oldest waiting donación, before triggering a ronda (AD-9, spec
 * `ronda-asignacion`, `GET /rondas/fondo` via the BFF `rondas` proxy). ADMINISTRADOR-only route.
 */
export function useFondoRonda() {
  return useQuery<RondaFondoResponse>({
    queryKey: FONDO_KEY,
    queryFn: () => api.get<RondaFondoResponse>('/rondas/fondo').then((r) => r.data),
  });
}

/** Paged ronda history, most recent first (`GET /rondas`), for the `/rondas` admin screen. */
export function useHistorialRondas(params?: PageParams) {
  return useQuery<PageData<RondaResponse>>({
    queryKey: HISTORIAL_KEY(params),
    queryFn: () =>
      api.get<PageData<RondaResponse>>('/rondas', { params }).then((r) => r.data),
  });
}

/**
 * Assignments produced by one ronda, best score first (`GET /rondas/{id}/asignaciones`,
 * ADMINISTRADOR-only). Disabled while `id` is null.
 */
export function useAsignacionesRonda(id: number | null) {
  return useQuery<AsignacionRonda[]>({
    queryKey: ['rondas', 'asignaciones', id] as const,
    queryFn: () => api.get<AsignacionRonda[]>(`/rondas/${id}/asignaciones`).then((r) => r.data),
    enabled: id != null,
  });
}

/**
 * Triggers a manual ronda (`POST /rondas`, ADMINISTRADOR-only — AD-9). `409 RONDA_EN_CURSO` and
 * `503 WORKER_NO_DISPONIBLE` (or `502 RESPUESTA_WORKER_INVALIDA`) surface as the mutation's error;
 * the caller maps them to a friendly message. On success, invalidates the pool and history queries
 * so the screen reflects the run without a manual refetch.
 */
export function useEjecutarRonda() {
  const queryClient = useQueryClient();

  const idempotency = useIdempotencyKey();
  return useMutation<RondaResponse, Error, void>({
    mutationFn: () =>
      idempotency.run(null, (key) =>
        api
          .post<RondaResponse>('/rondas', undefined, { headers: idempotencyHeaders(key) })
          .then((r) => r.data),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FONDO_KEY });
      void queryClient.invalidateQueries({ queryKey: ['rondas', 'historial'] });
    },
  });
}
