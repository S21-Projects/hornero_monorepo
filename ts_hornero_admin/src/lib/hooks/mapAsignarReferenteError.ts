import type { AxiosError } from 'axios';

/**
 * Maps an error from `PATCH /organizaciones/{id}/referente` (admin
 * reassignment) to a user-visible Spanish string.
 * - 404: target user doesn't exist.
 * - 400: target user isn't a referente.
 * - 409: target referente is inactive, or already at the 3-organización cap.
 */
export function mapAsignarReferenteError(error: unknown): string {
  const status = (error as AxiosError)?.response?.status;
  if (status === 404) return 'Referente no encontrado';
  if (status === 400) return 'El usuario seleccionado no es un referente';
  if (status === 409) return 'El referente está inactivo o alcanzó el máximo de 3 organizaciones';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
