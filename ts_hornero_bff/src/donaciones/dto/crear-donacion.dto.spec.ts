import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CrearDonacionDto } from './crear-donacion.dto.js';

describe('CrearDonacionDto', () => {
  describe('DIRECTA (default modalidad)', () => {
    it('accepts a necesidadId with ≥1 lineas and no modalidad field', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        necesidadId: 5,
        lineas: [{ articuloId: 1, cantidad: 2 }],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts an explicit DIRECTA with necesidadId and lineas', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'DIRECTA',
        necesidadId: 5,
        lineas: [{ articuloId: 1, cantidad: 2 }],
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects DIRECTA with no necesidadId', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'DIRECTA',
        lineas: [{ articuloId: 1, cantidad: 2 }],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'necesidadId')).toBe(true);
    });

    it('rejects DIRECTA carrying latitud/longitud', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'DIRECTA',
        necesidadId: 5,
        lineas: [{ articuloId: 1, cantidad: 2 }],
        latitud: -34.6,
        longitud: -58.4,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitud')).toBe(true);
      expect(errors.some((e) => e.property === 'longitud')).toBe(true);
    });
  });

  describe('FONDO_COMUN', () => {
    it('accepts a well-formed FONDO_COMUN payload with lineas', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'FONDO_COMUN',
        lineas: [{ articuloId: 1, cantidad: 2 }],
        latitud: -34.6,
        longitud: -58.4,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects FONDO_COMUN carrying necesidadId', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'FONDO_COMUN',
        necesidadId: 5,
        lineas: [{ articuloId: 1, cantidad: 2 }],
        latitud: -34.6,
        longitud: -58.4,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'necesidadId')).toBe(true);
    });

    it('rejects FONDO_COMUN with no latitud/longitud', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'FONDO_COMUN',
        lineas: [{ articuloId: 1, cantidad: 2 }],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitud')).toBe(true);
      expect(errors.some((e) => e.property === 'longitud')).toBe(true);
    });
  });

  it('rejects an unknown modalidad value', async () => {
    const dto = plainToInstance(CrearDonacionDto, {
      modalidad: 'OTRA',
      necesidadId: 5,
      lineas: [{ articuloId: 1, cantidad: 2 }],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'modalidad')).toBe(true);
  });

  describe('lineas (decision 4 — required for both modalidades)', () => {
    it('rejects a missing lineas field', async () => {
      const dto = plainToInstance(CrearDonacionDto, { necesidadId: 5 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'lineas')).toBe(true);
    });

    it('rejects an empty lineas array', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        necesidadId: 5,
        lineas: [],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'lineas')).toBe(true);
    });

    it('rejects a linea missing articuloId', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        necesidadId: 5,
        lineas: [{ cantidad: 2 }],
      });
      const errors = await validate(dto);
      const lineaErrors = errors.find((e) => e.property === 'lineas')
        ?.children?.[0]?.children;
      expect(lineaErrors?.some((c) => c.property === 'articuloId')).toBe(true);
    });

    it('rejects a linea with cantidad <= 0', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        necesidadId: 5,
        lineas: [{ articuloId: 1, cantidad: 0 }],
      });
      const errors = await validate(dto);
      const lineaErrors = errors.find((e) => e.property === 'lineas')
        ?.children?.[0]?.children;
      expect(lineaErrors?.some((c) => c.property === 'cantidad')).toBe(true);
    });
  });
});
