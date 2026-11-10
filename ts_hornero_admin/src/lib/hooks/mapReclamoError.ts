import type { AxiosError } from 'axios';

interface ErrorBody {
  message?: string;
}

/**
 * Maps an error from the claim endpoints to a user-visible Spanish string. The MS answers 409 for
 * several distinct rules (not claimable, already pending, cap, inactive claimant, already
 * resolved, concurrent change) and carries the reason in `message`. `contexto` switches the voice
 * between the claimant ("tu cargo") and the admin reviewing the claim ("su cargo").
 */
export function mapReclamoError(error: unknown, contexto: 'referente' | 'admin' = 'referente'): string {
  const response = (error as AxiosError<ErrorBody>)?.response;
  const status = response?.status;
  const message = response?.data?.message ?? '';
  const admin = contexto === 'admin';
  if (status === 409) {
    if (message === 'CONFLICTO_CONCURRENTE') {
      return 'Otro administrador resolvió este reclamo al mismo tiempo. Actualizá la lista.';
    }
    // Matched by code before /pendiente/i below, which would swallow it (case-insensitive).
    if (message === 'LIMITE_RECLAMOS_PENDIENTES') {
      return 'Ya tenés muchos reclamos en revisión. Esperá a que un administrador resuelva alguno.';
    }
    if (/ya fue resuelto/i.test(message)) return 'Este reclamo ya fue resuelto.';
    if (/pendiente/i.test(message)) return 'Ya tenés un reclamo pendiente para este comedor.';
    if (/máximo/i.test(message)) {
      return admin
        ? 'El solicitante ya alcanzó el máximo de 3 organizaciones a su cargo.'
        : 'Alcanzaste el máximo de 3 organizaciones a tu cargo.';
    }
    if (/inactivo/i.test(message)) return 'El solicitante está inactivo.';
    return 'Este comedor ya no está disponible para ser reclamado.';
  }
  if (status === 400) {
    if (message === 'EVIDENCIA_CLAVE_INVALIDA') return 'La evidencia adjunta no es válida. Subila de nuevo.';
    return admin ? 'Revisá el motivo del rechazo.' : 'Revisá los datos del reclamo.';
  }
  if (status === 429) return 'Enviaste demasiados reclamos hoy. Intentá de nuevo mañana.';
  if (status === 403) return 'No tenés permiso para esta acción.';
  if (status === 404) return 'No encontramos el comedor o el reclamo.';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
