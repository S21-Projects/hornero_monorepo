import type { AxiosError } from 'axios';

/**
 * Maps an error from a donación mutation (`POST /donaciones`) to a user-visible Spanish string.
 * - 403 `EMAIL_NO_VERIFICADO`: the donante hasn't verified their email yet.
 * - 400 `ARTICULO_INCOMPATIBLE`: none of the offered lines match what the necesidad requests
 *   (feature catalogo-articulos, DIRECTA-compatibility gap, decision 6).
 * - 400 "inactivo": one of the chosen articulos was deactivated after being listed
 *   (feature catalogo-articulos, decision 3).
 * - anything else 400: generic validation fallback; anything else: generic fallback.
 */
export function mapDonacionError(error: unknown): string {
  const response = (error as AxiosError<{ message?: string }>)?.response;
  const status = response?.status;
  const message = response?.data?.message ?? '';

  if (status === 403 && message === 'EMAIL_NO_VERIFICADO') {
    return 'Todavía no verificaste tu email. Verificalo para poder ofrecer donaciones.';
  }
  if (status === 400 && message.includes('ARTICULO_INCOMPATIBLE')) {
    return 'Ninguno de los artículos ofrecidos corresponde a lo solicitado por esta necesidad.';
  }
  if (status === 400 && /inactivo/i.test(message)) {
    return 'Uno de los artículos elegidos ya no está disponible. Actualizá la selección.';
  }
  if (status === 400) {
    return 'Revisá los artículos y cantidades ingresados.';
  }
  return 'No se pudo registrar la donación. Intentá de nuevo más tarde.';
}
