import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../axios';

/** Mirrors the MS `CodigoEntregaResponse` record via the 3b BFF proxy. */
export interface CodigoEntregaResponse {
  codigo: string;
  expiraEn: string;
}

/** Mirrors the MS `EntregaEstadoResponse` record via the 3b BFF proxy. */
export interface EntregaEstadoResponse {
  estado: string;
  confirmadaDonanteEn: string | null;
  confirmadaReferenteEn: string | null;
}

const ENTREGADA = 'ENTREGADA';
const POLL_MS = 3000;

function entregaQueryKey(donacionId: number | undefined) {
  return ['entrega', donacionId] as const;
}

/**
 * Both parties' delivery confirmation status, polled every 3s (spec `donacion-entrega-codigo`
 * — "Screen reflects the counterpart's confirmation status") until the donación reaches
 * `ENTREGADA`, at which point polling stops.
 */
export function useEstadoEntrega(donacionId: number | undefined) {
  return useQuery<EntregaEstadoResponse>({
    queryKey: entregaQueryKey(donacionId),
    queryFn: () =>
      api.get<EntregaEstadoResponse>(`/donaciones/${donacionId}/entrega`).then((r) => r.data),
    enabled: donacionId != null,
    refetchInterval: (query) => (query.state.data?.estado === ENTREGADA ? false : POLL_MS),
  });
}

/** Generates the caller's own delivery code (donante or referente); burns any previous one (AD-6). */
export function useGenerarCodigo(donacionId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation<CodigoEntregaResponse, Error, void>({
    mutationFn: () =>
      api
        .post<CodigoEntregaResponse>(`/donaciones/${donacionId}/entrega/codigo`)
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entregaQueryKey(donacionId) });
    },
  });
}

/** Verifies the counterpart's code (scanned or typed); the MS transitions the donación per AD-5. */
export function useVerificarCodigo(donacionId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation<EntregaEstadoResponse, Error, string>({
    mutationFn: (codigo) =>
      api
        .post<EntregaEstadoResponse>(`/donaciones/${donacionId}/entrega/verificar`, { codigo })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: entregaQueryKey(donacionId) });
    },
  });
}
