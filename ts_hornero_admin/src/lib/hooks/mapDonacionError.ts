import type { AxiosError } from 'axios';

/**
 * Maps an error from a donación mutation (`POST /donaciones`) to a user-visible Spanish string.
 * - 403 `EMAIL_NO_VERIFICADO`: the donante hasn't verified their email yet.
 * - 400 `ARTICULO_INCOMPATIBLE`: none of the offered lines match what the necesidad requests
 *   (feature catalogo-articulos, DIRECTA-compatibility gap, decision 6).
 * - 400 "inactivo": one of the chosen articulos was deactivated after being listed
 *   (feature catalogo-articulos, decision 3).
 * - 409 `ORGANIZACION_NO_APROBADA` (N1), `CONFLICTO_CONCURRENTE` (N11 optimistic lock),
 *   `IDEMPOTENCIA_EN_PROCESO` and 422 `IDEMPOTENCIA_PAYLOAD_DISTINTO` (N11).
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
  if (status === 409 && message.includes('NECESIDAD_NO_DISPONIBLE')) {
    return 'Esta necesidad ya no recibe donaciones (está cerrada o vencida).';
  }
  if (status === 409 && message.includes('ORGANIZACION_NO_APROBADA')) {
    return 'La organización todavía no está aprobada para recibir donaciones.';
  }
  if (status === 409 && message.includes('CONFLICTO_CONCURRENTE')) {
    return 'Otra operación modificó estos datos al mismo tiempo. Volvé a intentar.';
  }
  if (status === 409 && message.includes('IDEMPOTENCIA_EN_PROCESO')) {
    return 'Esta operación todavía se está procesando. Esperá unos segundos antes de reintentar.';
  }
  if (status === 422 && message.includes('IDEMPOTENCIA_PAYLOAD_DISTINTO')) {
    return 'Esta solicitud cambió desde el primer envío. Recargá la página y volvé a intentar.';
  }
  if (status === 400) {
    return 'Revisá los artículos y cantidades ingresados.';
  }
  return 'No se pudo registrar la donación. Intentá de nuevo más tarde.';
}
