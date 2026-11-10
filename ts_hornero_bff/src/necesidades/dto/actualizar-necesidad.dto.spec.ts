import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ActualizarNecesidadDto } from './actualizar-necesidad.dto.js';

describe('ActualizarNecesidadDto', () => {
  it('accepts a payload with no articuloIds (unchanged, per convention)', async () => {
    const dto = plainToInstance(ActualizarNecesidadDto, {
      descripcion: 'Nueva descripción',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a non-empty articuloIds array', async () => {
    const dto = plainToInstance(ActualizarNecesidadDto, {
      articuloIds: [1, 2],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty articuloIds array (a necesidad can never be left with zero articulos)', async () => {
    const dto = plainToInstance(ActualizarNecesidadDto, { articuloIds: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'articuloIds')).toBe(true);
  });

  it('rejects a non-integer entry in articuloIds', async () => {
    const dto = plainToInstance(ActualizarNecesidadDto, {
      articuloIds: ['x'],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'articuloIds')).toBe(true);
  });
});
