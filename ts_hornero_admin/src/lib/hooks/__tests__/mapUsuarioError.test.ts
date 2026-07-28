import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { mapUsuarioError } from '../mapUsuarioError';

function makeAxiosError(status: number) {
  return Object.assign(new axios.AxiosError('Request failed'), {
    response: { status, data: {}, headers: {}, config: {} as never, statusText: '' },
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
});
