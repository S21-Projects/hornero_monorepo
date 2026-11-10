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

  it('maps ORGANIZACION_NO_APROBADA (409) to a friendly message', () => {
    expect(mapDonacionError(axiosError(409, 'ORGANIZACION_NO_APROBADA: la organización aún no está aprobada para recibir donaciones')))
      .toMatch(/organización todavía no está aprobada/i);
  });

  it('maps NECESIDAD_NO_DISPONIBLE (409) to a friendly message', () => {
    expect(mapDonacionError(axiosError(409, 'NECESIDAD_NO_DISPONIBLE: x'))).toMatch(/ya no recibe donaciones/i);
  });

  it('maps CONFLICTO_CONCURRENTE (409) asking to retry', () => {
    expect(mapDonacionError(axiosError(409, 'CONFLICTO_CONCURRENTE')))
      .toMatch(/otra operación.*volvé a intentar/i);
  });

  it('maps IDEMPOTENCIA_EN_PROCESO (409) to a still-processing message', () => {
    expect(mapDonacionError(axiosError(409, 'IDEMPOTENCIA_EN_PROCESO'))).toMatch(/todavía se está procesando/i);
  });

  it('maps IDEMPOTENCIA_PAYLOAD_DISTINTO (422) to a reload-and-retry message', () => {
    expect(mapDonacionError(axiosError(422, 'IDEMPOTENCIA_PAYLOAD_DISTINTO')))
      .toMatch(/recargá la página/i);
  });
});
