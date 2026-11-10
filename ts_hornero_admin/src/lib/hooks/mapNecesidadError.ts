import type { AxiosError } from 'axios';

/**
 * Maps an error from a necesidad mutation to a user-visible Spanish string.
 * - 400: the referente has no organization associated yet.
 * - 403: the referente doesn't own this need.
 * - 400/409 with an MS error code (past date, not expired, cap reached): specific messages.
 * - anything else: generic fallback.
 */
export function mapNecesidadError(error: unknown): string {
  const response = (error as AxiosError<{ message?: string }>)?.response;
  const status = response?.status;
  const message = response?.data?.message ?? '';
  if (status === 400 && message.includes('FECHA_VENCIMIENTO_PASADA')) {
    return 'La fecha de vencimiento debe ser posterior a hoy.';
  }
  if (status === 409 && message.includes('NECESIDAD_NO_VENCIDA')) {
    return 'Esta necesidad no está vencida, no hace falta relanzarla.';
  }
  if (status === 409 && message.includes('NECESIDAD_VENCIDA_USAR_RELANZAR')) {
    return 'Una necesidad vencida solo se reabre con el botón «Relanzar».';
  }
  if (status === 409 && message.includes('Alcanzaste el máximo')) {
    return 'Alcanzaste el máximo de necesidades abiertas de tu nivel. Cerrá alguna antes de publicar o relanzar.';
  }
  if (status === 400) return 'Aún no tenés una organización asociada';
  if (status === 403) return 'No sos dueño de esta necesidad';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
