import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { mapAsignarReferenteError } from '../mapAsignarReferenteError';

function makeAxiosError(status: number) {
  return Object.assign(new axios.AxiosError('Request failed'), {
    response: { status, data: {}, headers: {}, config: {} as never, statusText: '' },
  });
}

describe('mapAsignarReferenteError', () => {
  it('returns not-found message for 404', () => {
    expect(mapAsignarReferenteError(makeAxiosError(404))).toBe('Referente no encontrado');
  });

  it('returns not-a-referente message for 400', () => {
    expect(mapAsignarReferenteError(makeAxiosError(400))).toBe(
      'El usuario seleccionado no es un referente',
    );
  });

  it('returns inactive/cap message for 409', () => {
    expect(mapAsignarReferenteError(makeAxiosError(409))).toBe(
      'El referente está inactivo o alcanzó el máximo de 3 organizaciones',
    );
  });

  it('returns generic message for 500', () => {
    expect(mapAsignarReferenteError(makeAxiosError(500))).toBe(
      'Ocurrió un error. Intentá de nuevo más tarde.',
    );
  });

  it('returns generic message for null', () => {
    expect(mapAsignarReferenteError(null)).toBe('Ocurrió un error. Intentá de nuevo más tarde.');
  });
});
