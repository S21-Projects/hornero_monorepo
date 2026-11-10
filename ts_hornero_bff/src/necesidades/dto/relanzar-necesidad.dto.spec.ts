import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RelanzarNecesidadDto } from './relanzar-necesidad.dto.js';

describe('RelanzarNecesidadDto', () => {
  it('accepts an ISO date', async () => {
    const dto = plainToInstance(RelanzarNecesidadDto, {
      fechaVencimiento: '2026-12-01',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('requires fechaVencimiento', async () => {
    const dto = plainToInstance(RelanzarNecesidadDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fechaVencimiento')).toBe(true);
  });

  it('rejects a non-date value', async () => {
    const dto = plainToInstance(RelanzarNecesidadDto, {
      fechaVencimiento: 'mañana',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'fechaVencimiento')).toBe(true);
  });
});
