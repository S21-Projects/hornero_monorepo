import type { AxiosError } from 'axios';

const GENERICO = 'Ocurrió un error. Intentá de nuevo más tarde.';

/**
 * Maps an error from a usuario mutation to a user-visible Spanish string.
 * - 404: user not found.
 * - 409 (N15, anonimizar): `USUARIO_YA_ANONIMIZADO`, `ANONIMIZAR_CUENTA_PROPIA`,
 *   `ULTIMO_ADMINISTRADOR`, `REFERENTE_CON_ORGANIZACIONES`; N11 `IDEMPOTENCIA_EN_PROCESO`.
 * - anything else: generic fallback.
 */
export function mapUsuarioError(error: unknown): string {
  const response = (error as AxiosError<{ message?: string }>)?.response;
  const status = response?.status;
  const message = response?.data?.message ?? '';
  if (status === 404) return 'Usuario no encontrado';
  if (status === 409) {
    if (message.includes('USUARIO_YA_ANONIMIZADO')) return 'Esta cuenta ya fue anonimizada.';
    if (message.includes('ANONIMIZAR_CUENTA_PROPIA')) return 'No podés anonimizar tu propia cuenta.';
    if (message.includes('ULTIMO_ADMINISTRADOR')) {
      return 'No se puede anonimizar al último administrador activo.';
    }
    if (message.includes('REFERENTE_CON_ORGANIZACIONES')) {
      return 'Este referente tiene organizaciones a su cargo. Reasigná cada organización a otro referente y volvé a intentar.';
    }
    if (message.includes('IDEMPOTENCIA_EN_PROCESO')) {
      return 'La operación todavía se está procesando. Esperá unos segundos antes de reintentar.';
    }
  }
  return GENERICO;
}
