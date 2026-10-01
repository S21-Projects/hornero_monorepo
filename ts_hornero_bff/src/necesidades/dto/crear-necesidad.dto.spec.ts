import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CrearNecesidadDto } from './crear-necesidad.dto.js';

describe('CrearNecesidadDto', () => {
  const base = {
    descripcion: 'Arroz y fideos',
    prioridad: 'URGENTE',
    organizacionId: 1,
  };

  it('accepts a payload with ≥1 articuloIds', async () => {
    const dto = plainToInstance(CrearNecesidadDto, {
      ...base,
      articuloIds: [1, 2],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing articuloIds field (decision 6 — ≥1 required)', async () => {
    const dto = plainToInstance(CrearNecesidadDto, { ...base });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'articuloIds')).toBe(true);
  });

  it('rejects an empty articuloIds array', async () => {
    const dto = plainToInstance(CrearNecesidadDto, {
      ...base,
      articuloIds: [],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'articuloIds')).toBe(true);
  });

  it('rejects a non-integer entry in articuloIds', async () => {
    const dto = plainToInstance(CrearNecesidadDto, {
      ...base,
      articuloIds: ['x'],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'articuloIds')).toBe(true);
  });
});
