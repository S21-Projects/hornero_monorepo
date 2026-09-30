import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { Donacion } from '../../types/domain';

/**
 * Single donación by id via the MS's public `GET /api/donaciones/{id}` (proxied unauthenticated
 * by the BFF). Used by the confirmation screen (`routes/entrega.tsx`) to render the counterpart's
 * name in the header ("Donación #id" + counterpart name).
 */
export function useDonacion(id: number | undefined) {
  return useQuery<Donacion>({
    queryKey: ['donaciones', id],
    queryFn: () => api.get<Donacion>(`/donaciones/${id}`).then((r) => r.data),
    enabled: id != null,
  });
}
