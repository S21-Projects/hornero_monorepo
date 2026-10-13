import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { mapUsuarioError } from '../mapUsuarioError';

function makeAxiosError(status: number, message?: string) {
  return Object.assign(new axios.AxiosError('Request failed'), {
    response: { status, data: message ? { message } : {}, headers: {}, config: {} as never, statusText: '' },
  });
}

describe('mapUsuarioError', () => {
  it('returns not-found message for 404', () => {
    expect(mapUsuarioError(makeAxiosError(404))).toBe('Usuario no encontrado');
  });

  it('returns generic message for 500', () => {
    expect(mapUsuarioError(makeAxiosError(500))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for plain Error (no response)', () => {
    expect(mapUsuarioError(new Error('network error'))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for null', () => {
    expect(mapUsuarioError(null)).toBe('Ocurrió un error. Intentá de nuevo más tarde.');
  });

  it.each([
    ['USUARIO_YA_ANONIMIZADO', 'Esta cuenta ya fue anonimizada.'],
    ['ANONIMIZAR_CUENTA_PROPIA', 'No podés anonimizar tu propia cuenta.'],
    ['ULTIMO_ADMINISTRADOR', 'No se puede anonimizar al último administrador activo.'],
    [
      'REFERENTE_CON_ORGANIZACIONES',
      'Este referente tiene organizaciones a su cargo. Reasigná cada organización a otro referente y volvé a intentar.',
    ],
    ['IDEMPOTENCIA_EN_PROCESO', 'La operación todavía se está procesando. Esperá unos segundos antes de reintentar.'],
  ])('maps the 409 %s code', (code, expected) => {
    expect(mapUsuarioError(makeAxiosError(409, code))).toBe(expected);
  });

  it('falls back for an unknown 409', () => {
    expect(mapUsuarioError(makeAxiosError(409, 'OTRA_COSA'))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });
});
