import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { mapCrearOrganizacionError } from '../mapCrearOrganizacionError';

function makeAxiosError(status: number) {
  return Object.assign(new axios.AxiosError('Request failed'), {
    response: { status, data: {}, headers: {}, config: {} as never, statusText: '' },
  });
}

describe('mapCrearOrganizacionError', () => {
  it('returns the cap message for 409', () => {
    expect(mapCrearOrganizacionError(makeAxiosError(409))).toBe(
      'Alcanzaste el máximo de 3 organizaciones',
    );
  });

  it('returns generic message for 500', () => {
    expect(mapCrearOrganizacionError(makeAxiosError(500))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for plain Error (no response)', () => {
    expect(mapCrearOrganizacionError(new Error('network error'))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for null', () => {
    expect(mapCrearOrganizacionError(null)).toBe('Ocurrió un error. Intentá de nuevo más tarde.');
  });
});
