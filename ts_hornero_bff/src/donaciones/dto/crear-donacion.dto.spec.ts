import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CrearDonacionDto } from './crear-donacion.dto.js';

describe('CrearDonacionDto', () => {
  describe('DIRECTA (default modalidad)', () => {
    it('accepts a necesidadId with no modalidad field', async () => {
      const dto = plainToInstance(CrearDonacionDto, { necesidadId: 5 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts an explicit DIRECTA with necesidadId', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'DIRECTA',
        necesidadId: 5,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects DIRECTA with no necesidadId', async () => {
      const dto = plainToInstance(CrearDonacionDto, { modalidad: 'DIRECTA' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'necesidadId')).toBe(true);
    });

    it('rejects DIRECTA carrying categoria', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'DIRECTA',
        necesidadId: 5,
        categoria: 'NO_PERECEDERO',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'categoria')).toBe(true);
    });

    it('rejects DIRECTA carrying latitud/longitud', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'DIRECTA',
        necesidadId: 5,
        latitud: -34.6,
        longitud: -58.4,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'latitud')).toBe(true);
      expect(errors.some((e) => e.property === 'longitud')).toBe(true);
    });
  });

  describe('FONDO_COMUN', () => {
    it('accepts a well-formed FONDO_COMUN payload', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'FONDO_COMUN',
        categoria: 'NO_PERECEDERO',
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
        categoria: 'NO_PERECEDERO',
        latitud: -34.6,
        longitud: -58.4,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'necesidadId')).toBe(true);
    });

    it('rejects FONDO_COMUN with no categoria', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'FONDO_COMUN',
        latitud: -34.6,
        longitud: -58.4,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'categoria')).toBe(true);
    });

    it('rejects FONDO_COMUN with no latitud/longitud', async () => {
      const dto = plainToInstance(CrearDonacionDto, {
        modalidad: 'FONDO_COMUN',
        categoria: 'NO_PERECEDERO',
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
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'modalidad')).toBe(true);
  });
});
