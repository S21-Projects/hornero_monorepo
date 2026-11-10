import type { AxiosError } from 'axios';

interface ErrorBody {
  message?: string;
}

/**
 * Maps an error from the report endpoints to a user-visible Spanish string. The MS answers 409 for
 * several distinct rules (not reportable, already pending, already resolved, concurrent change) and
 * carries the reason in `message`.
 */
export function mapReporteError(error: unknown, contexto: 'usuario' | 'admin' = 'usuario'): string {
  const response = (error as AxiosError<ErrorBody>)?.response;
  const status = response?.status;
  const message = response?.data?.message ?? '';
  if (status === 409) {
    if (message === 'CONFLICTO_CONCURRENTE') {
      return 'Otro administrador resolvió este reporte al mismo tiempo. Actualizá la lista.';
    }
    if (message === 'LIMITE_REPORTES_PENDIENTES') {
      return 'Ya tenés muchos reportes en revisión. Esperá a que un administrador resuelva alguno.';
    }
    if (/ya fue resuelto/i.test(message)) return 'Este reporte ya fue resuelto.';
    if (/pendiente/i.test(message)) return 'Ya tenés un reporte pendiente para este comedor.';
    return contexto === 'admin'
      ? 'Este comedor ya no está sin reclamar: descartá el reporte.'
      : 'Este comedor ya no se puede reportar.';
  }
  if (status === 400) {
    if (/nota/i.test(message)) return 'La nota es obligatoria.';
    return contexto === 'admin'
      ? 'Revisá la nota del descarte.'
      : 'Revisá los datos del reporte. Si es un duplicado, elegí con qué organización.';
  }
  if (status === 429) return 'Enviaste demasiados reportes hoy. Intentá de nuevo mañana.';
  if (status === 403 && message === 'EMAIL_NO_VERIFICADO') return 'Verificá tu email para poder reportar.';
  if (status === 403) return 'No tenés permiso para esta acción.';
  if (status === 404) return 'No encontramos el comedor o el reporte.';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
