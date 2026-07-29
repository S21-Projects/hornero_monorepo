import type { AxiosError } from 'axios';

/**
 * Maps an error from `POST /organizaciones` (registration org step or
 * self-service "add organización") to a user-visible Spanish string.
 * - 409: referente already owns the max of 3 (non-RECHAZADA) organizaciones.
 * - anything else: generic fallback.
 *
 * Deliberately separate from `mapOrganizacionError` (D6): that mapper already
 * maps 409 to "ya fue procesada" for the admin validate/reject flow, which is
 * a different meaning for the same status code.
 */
export function mapCrearOrganizacionError(error: unknown): string {
  const status = (error as AxiosError)?.response?.status;
  if (status === 409) return 'Alcanzaste el máximo de 3 organizaciones';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
