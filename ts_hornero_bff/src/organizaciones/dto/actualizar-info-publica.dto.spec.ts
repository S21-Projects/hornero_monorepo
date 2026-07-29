import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ActualizarInfoPublicaDto } from './actualizar-info-publica.dto.js';

describe('ActualizarInfoPublicaDto', () => {
  it('accepts an empty string as the clear sentinel', async () => {
    const dto = plainToInstance(ActualizarInfoPublicaDto, { sitioWebUrl: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid https URL', async () => {
    const dto = plainToInstance(ActualizarInfoPublicaDto, {
      sitioWebUrl: 'https://example.org',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid http URL', async () => {
    const dto = plainToInstance(ActualizarInfoPublicaDto, {
      donacionDirectaUrl: 'http://example.org',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a javascript: scheme', async () => {
    const dto = plainToInstance(ActualizarInfoPublicaDto, {
      sitioWebUrl: 'javascript:alert(1)',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sitioWebUrl');
  });

  it('rejects a data: scheme', async () => {
    const dto = plainToInstance(ActualizarInfoPublicaDto, {
      donacionDirectaUrl: 'data:text/html,<script>alert(1)</script>',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts a boolean aceptaDonaciones', async () => {
    const dto = plainToInstance(ActualizarInfoPublicaDto, {
      aceptaDonaciones: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-boolean aceptaDonaciones', async () => {
    const dto = plainToInstance(ActualizarInfoPublicaDto, {
      aceptaDonaciones: 'yes',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
