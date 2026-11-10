import { describe, it, expect } from 'vitest';
import type { AxiosError } from 'axios';
import { mapArticuloError } from './mapArticuloError';

function withStatus(status: number): AxiosError {
  return { response: { status } } as AxiosError;
}

describe('mapArticuloError', () => {
  it('maps 404 to "artículo ya no existe"', () => {
    expect(mapArticuloError(withStatus(404))).toBe('El artículo ya no existe.');
  });

  it('maps 400 to a validation message', () => {
    expect(mapArticuloError(withStatus(400))).toBe('Revisá los datos del artículo.');
  });

  it('falls back to a generic message for anything else', () => {
    expect(mapArticuloError(withStatus(500))).toBe('Ocurrió un error. Intentá de nuevo más tarde.');
    expect(mapArticuloError(new Error('network'))).toBe('Ocurrió un error. Intentá de nuevo más tarde.');
  });
});
