import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { mapInfoPublicaError } from '../mapInfoPublicaError';

function makeAxiosError(status: number) {
  return Object.assign(new axios.AxiosError('Request failed'), {
    response: { status, data: {}, headers: {}, config: {} as never, statusText: '' },
  });
}

describe('mapInfoPublicaError', () => {
  it('returns the URL-format message for 400', () => {
    expect(mapInfoPublicaError(makeAxiosError(400))).toBe(
      'Revisá que los enlaces empiecen con http:// o https://',
    );
  });

  it('returns the ownership message for 403', () => {
    expect(mapInfoPublicaError(makeAxiosError(403))).toBe(
      'No tenés permiso para editar esta organización',
    );
  });

  it('returns the no-pending message for 409 (aprobar/rechazar with nothing pending)', () => {
    expect(mapInfoPublicaError(makeAxiosError(409))).toBe(
      'No hay cambios pendientes de aprobación',
    );
  });

  it('returns generic message for 500', () => {
    expect(mapInfoPublicaError(makeAxiosError(500))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for a plain Error', () => {
    expect(mapInfoPublicaError(new Error('network error'))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });
});
