import type { AxiosError } from 'axios';

/**
 * Maps an error from an organización mutation to a user-visible Spanish string.
 * - 409: org was already validated or rejected (not PENDIENTE).
 * - 404: org not found.
 * - anything else: generic fallback.
 */
export function mapOrganizacionError(error: unknown): string {
  const status = (error as AxiosError)?.response?.status;
  if (status === 409) return 'Esta organización ya fue procesada';
  if (status === 404) return 'Organización no encontrada';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
