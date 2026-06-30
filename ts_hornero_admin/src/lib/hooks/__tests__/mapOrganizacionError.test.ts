import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { mapOrganizacionError } from '../mapOrganizacionError';

function makeAxiosError(status: number) {
  return Object.assign(new axios.AxiosError('Request failed'), {
    response: { status, data: {}, headers: {}, config: {} as never, statusText: '' },
  });
}

describe('mapOrganizacionError', () => {
  it('returns already-processed message for 409', () => {
    expect(mapOrganizacionError(makeAxiosError(409))).toBe(
      'Esta organización ya fue procesada',
    );
  });

  it('returns not-found message for 404', () => {
    expect(mapOrganizacionError(makeAxiosError(404))).toBe('Organización no encontrada');
  });

  it('returns generic message for 500', () => {
    expect(mapOrganizacionError(makeAxiosError(500))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for plain Error (no response)', () => {
    expect(mapOrganizacionError(new Error('network error'))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for null', () => {
    expect(mapOrganizacionError(null)).toBe('Ocurrió un error. Intentá de nuevo más tarde.');
  });
});
