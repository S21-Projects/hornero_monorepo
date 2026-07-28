import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { mapNecesidadError } from '../mapNecesidadError';

function makeAxiosError(status: number) {
  return Object.assign(new axios.AxiosError('Request failed'), {
    response: { status, data: {}, headers: {}, config: {} as never, statusText: '' },
  });
}

describe('mapNecesidadError', () => {
  it('returns no-org message for 400', () => {
    expect(mapNecesidadError(makeAxiosError(400))).toBe(
      'Aún no tenés una organización asociada',
    );
  });

  it('returns ownership message for 403', () => {
    expect(mapNecesidadError(makeAxiosError(403))).toBe('No sos dueño de esta necesidad');
  });

  it('returns generic message for 500', () => {
    expect(mapNecesidadError(makeAxiosError(500))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for plain Error (no response)', () => {
    expect(mapNecesidadError(new Error('network error'))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for null', () => {
    expect(mapNecesidadError(null)).toBe('Ocurrió un error. Intentá de nuevo más tarde.');
  });
});
