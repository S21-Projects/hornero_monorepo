import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../axios';
import type { Actividad } from '../../types/domain';
import type { PageData, PageParams } from '../../types/api';

export interface ActividadParams extends PageParams {
  actorUsuarioId?: number;
  accion?: string;
  resultado?: string;
  desde?: string;
  hasta?: string;
}

/** ADMINISTRADOR-only: paginated, read-only activity log for `/actividad`. */
export function useActividad(params?: ActividadParams) {
  return useQuery<PageData<Actividad>>({
    queryKey: ['actividad', params ?? {}],
    queryFn: () => api.get<PageData<Actividad>>('/actividad', { params }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
}
