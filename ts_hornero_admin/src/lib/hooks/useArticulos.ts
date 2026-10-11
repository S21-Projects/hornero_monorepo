import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { api } from '../axios';
import { idempotencyHeaders, useIdempotencyKey } from '../idempotency';
import type { Articulo, ArticuloInput } from '../../types/domain';

const ARTICULOS_KEY = ['articulos'] as const;

/**
 * `GET /articulos` (public; BFF `articulos` proxy, feature catalogo-articulos work unit E).
 * Active items only by default — pass `incluirInactivos: true` (ADMINISTRADOR catalog screen) to
 * also see deactivated items. Not paginated: the MS returns the full list.
 */
export function useArticulos(incluirInactivos = false) {
  return useQuery<Articulo[]>({
    queryKey: [...ARTICULOS_KEY, { incluirInactivos }],
    queryFn: () =>
      api
        .get<Articulo[]>('/articulos', incluirInactivos ? { params: { incluirInactivos: true } } : undefined)
        .then((r) => r.data),
  });
}

function invalidateArticulos(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ARTICULOS_KEY });
}

/** `POST /articulos` (ADMINISTRADOR only). */
export function useCrearArticulo() {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyKey();
  return useMutation<Articulo, Error, ArticuloInput>({
    mutationFn: (input) =>
      idempotency.run(input, (key) =>
        api
          .post<Articulo>('/articulos', input, { headers: idempotencyHeaders(key) })
          .then((r) => r.data),
      ),
    onSuccess: () => invalidateArticulos(queryClient),
  });
}

/** `PUT /articulos/:id` — full edit of nombre/categoria/unidad (ADMINISTRADOR only). */
export function useEditarArticulo() {
  const queryClient = useQueryClient();
  return useMutation<Articulo, Error, { id: number; input: ArticuloInput }>({
    mutationFn: ({ id, input }) => api.put<Articulo>(`/articulos/${id}`, input).then((r) => r.data),
    onSuccess: () => invalidateArticulos(queryClient),
  });
}

/** `PATCH /articulos/:id/desactivar` — soft delete, never a hard delete (ADMINISTRADOR only). */
export function useDesactivarArticulo() {
  const queryClient = useQueryClient();
  return useMutation<Articulo, Error, number>({
    mutationFn: (id) => api.patch<Articulo>(`/articulos/${id}/desactivar`, {}).then((r) => r.data),
    onSuccess: () => invalidateArticulos(queryClient),
  });
}

/** `PATCH /articulos/:id/reactivar` — undoes a deactivation (ADMINISTRADOR only). */
export function useReactivarArticulo() {
  const queryClient = useQueryClient();
  return useMutation<Articulo, Error, number>({
    mutationFn: (id) => api.patch<Articulo>(`/articulos/${id}/reactivar`, {}).then((r) => r.data),
    onSuccess: () => invalidateArticulos(queryClient),
  });
}
