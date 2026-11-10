import { useQuery } from '@tanstack/react-query';
import { api } from '../axios';
import type { AsignacionHistorial } from '../../types/domain';

/**
 * `Asignacion` history for a donación (`GET /api/donaciones/{id}/asignaciones`, spec
 * `ronda-asignacion`), owner DONANTE, involved REFERENTE, or ADMINISTRADOR. Append-only —
 * reassignment after a devolución adds a new row rather than overwriting the prior one, so the
 * detail screen's timeline can show every past attempt.
 */
export function useAsignaciones(donacionId: number | undefined) {
  return useQuery<AsignacionHistorial[]>({
    queryKey: ['donaciones', donacionId, 'asignaciones'],
    queryFn: () =>
      api.get<AsignacionHistorial[]>(`/donaciones/${donacionId}/asignaciones`).then((r) => r.data),
    enabled: donacionId != null,
  });
}
