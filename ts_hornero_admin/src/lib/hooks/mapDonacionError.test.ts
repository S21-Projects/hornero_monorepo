import { describe, it, expect } from 'vitest';
import { mapDonacionError } from './mapDonacionError';

function axiosError(status: number, message?: string) {
  return { response: { status, data: message ? { message } : undefined } };
}

describe('mapDonacionError', () => {
  it('maps EMAIL_NO_VERIFICADO to a friendly message', () => {
    expect(mapDonacionError(axiosError(403, 'EMAIL_NO_VERIFICADO'))).toMatch(/verifica/i);
  });

  it('maps an ARTICULO_INCOMPATIBLE 400 to a friendly message', () => {
    expect(mapDonacionError(axiosError(400, 'ARTICULO_INCOMPATIBLE: la donación no incluye…')))
      .toMatch(/corresponde a lo solicitado/i);
  });

  it('maps an inactive-articulo 400 to a friendly message', () => {
    expect(mapDonacionError(axiosError(400, 'Articulo inválido o inactivo: 7')))
      .toMatch(/ya no está disponible/i);
  });

  it('falls back to a generic message for any other 400', () => {
    expect(mapDonacionError(axiosError(400, 'algo raro'))).toMatch(/revisá/i);
  });

  it('falls back to a generic message for anything else', () => {
    expect(mapDonacionError(axiosError(500))).toMatch(/intentá de nuevo/i);
  });
});
