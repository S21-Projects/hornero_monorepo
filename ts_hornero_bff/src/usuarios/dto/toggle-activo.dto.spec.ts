import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { VALIDATION_PIPE_OPTIONS } from '../../common/validation';
import { ToggleActivoDto } from './toggle-activo.dto';

describe('ToggleActivoDto', () => {
  const pipe = new ValidationPipe(VALIDATION_PIPE_OPTIONS);
  const transform = (value: unknown) =>
    pipe.transform(value, { type: 'body', metatype: ToggleActivoDto });

  it('accepts a boolean activo', async () => {
    await expect(transform({ activo: false })).resolves.toEqual({
      activo: false,
    });
  });

  it.each([{}, { activo: 'false' }, { activo: 1 }, { activo: null }])(
    'rejects a missing or non-boolean activo: %j',
    async (body) => {
      await expect(transform(body)).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('rejects extra fields', async () => {
    await expect(
      transform({ activo: true, tipo: 'ADMINISTRADOR' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
