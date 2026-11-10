import type { AxiosError } from 'axios';

/**
 * Maps an error from the articulo catalog admin mutations (`POST`/`PUT`/`PATCH /articulos`) to a
 * user-visible Spanish string. There is no uniqueness constraint on `nombre` on the MS side, so
 * no 409 case — just the validation (400) and not-found (404, e.g. two admins racing a
 * deactivate) paths, plus the generic fallback.
 */
export function mapArticuloError(error: unknown): string {
  const status = (error as AxiosError)?.response?.status;
  if (status === 404) return 'El artículo ya no existe.';
  if (status === 400) return 'Revisá los datos del artículo.';
  return 'Ocurrió un error. Intentá de nuevo más tarde.';
}
