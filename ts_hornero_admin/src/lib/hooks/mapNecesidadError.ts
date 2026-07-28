import type { AxiosError } from 'axios';

/**
 * Maps an error from a necesidad mutation to a user-visible Spanish string.
 * - 400: the referente has no organization associated yet.
 * - 403: the referente doesn't own this need.
 * - anything else: generic fallback.
 */
export function mapNecesidadError(error: unknown): string {
  const status = (error as AxiosError)?.response?.status;
  if (status === 400) return 'Aún no tenés una organización asociada';
  if (status === 403) return 'No sos dueño de esta necesidad';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
