import type { AxiosError } from 'axios';

/**
 * Maps errors from the info-pública endpoints
 * (`PATCH /organizaciones/{id}`, `/info-publica`, `/info-publica/aprobar`,
 * `/info-publica/rechazar`) to a user-visible Spanish string.
 * - 400: sitioWebUrl/donacionDirectaUrl failed the http(s) allowlist or is whitespace-only.
 * - 403: not the owning referente.
 * - 409: aprobar/rechazar called with no pending submission.
 */
export function mapInfoPublicaError(error: unknown): string {
  const status = (error as AxiosError)?.response?.status;
  if (status === 400) return 'Revisá que los enlaces empiecen con http:// o https://';
  if (status === 403) return 'No tenés permiso para editar esta organización';
  if (status === 409) return 'No hay cambios pendientes de aprobación';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
