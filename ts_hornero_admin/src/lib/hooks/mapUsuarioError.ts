import type { AxiosError } from 'axios';

/**
 * Maps an error from a usuario mutation to a user-visible Spanish string.
 * - 404: user not found.
 * - anything else: generic fallback.
 */
export function mapUsuarioError(error: unknown): string {
  const status = (error as AxiosError)?.response?.status;
  if (status === 404) return 'Usuario no encontrado';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
