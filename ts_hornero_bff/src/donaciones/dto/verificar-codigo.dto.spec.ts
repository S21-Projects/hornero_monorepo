import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { VerificarCodigoDto } from './verificar-codigo.dto.js';

describe('VerificarCodigoDto', () => {
  it('accepts a well-formed 6-digit code', async () => {
    const dto = plainToInstance(VerificarCodigoDto, { codigo: '482913' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a code with fewer than 6 digits', async () => {
    const dto = plainToInstance(VerificarCodigoDto, { codigo: '4829' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('codigo');
  });

  it('rejects a code with more than 6 digits', async () => {
    const dto = plainToInstance(VerificarCodigoDto, { codigo: '48291399' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a code containing non-digit characters', async () => {
    const dto = plainToInstance(VerificarCodigoDto, { codigo: '48a913' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an empty code', async () => {
    const dto = plainToInstance(VerificarCodigoDto, { codigo: '' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing codigo field', async () => {
    const dto = plainToInstance(VerificarCodigoDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
