import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { mapNecesidadError } from '../mapNecesidadError';

function makeAxiosError(status: number, message?: string) {
  return Object.assign(new axios.AxiosError('Request failed'), {
    response: { status, data: message ? { message } : {}, headers: {}, config: {} as never, statusText: '' },
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

  it('maps a past expiry date (400) to a date message, not the no-organization one', () => {
    expect(mapNecesidadError(makeAxiosError(400, 'FECHA_VENCIMIENTO_PASADA: x'))).toBe(
      'La fecha de vencimiento debe ser posterior a hoy.',
    );
  });

  it('maps NECESIDAD_NO_VENCIDA (409) to a friendly message', () => {
    expect(mapNecesidadError(makeAxiosError(409, 'NECESIDAD_NO_VENCIDA: x'))).toBe(
      'Esta necesidad no está vencida, no hace falta relanzarla.',
    );
  });

  it('maps NECESIDAD_VENCIDA_USAR_RELANZAR (409) to a friendly message', () => {
    expect(mapNecesidadError(makeAxiosError(409, 'NECESIDAD_VENCIDA_USAR_RELANZAR: x'))).toBe(
      'Una necesidad vencida solo se reabre con el botón «Relanzar».',
    );
  });

  it('maps the open-necesidades cap (409) to a friendly message', () => {
    expect(
      mapNecesidadError(makeAxiosError(409, 'Alcanzaste el máximo de 3 necesidades abiertas para el nivel N1')),
    ).toBe('Alcanzaste el máximo de necesidades abiertas de tu nivel. Cerrá alguna antes de publicar o relanzar.');
  });
});
