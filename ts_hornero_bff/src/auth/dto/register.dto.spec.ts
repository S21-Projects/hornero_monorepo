import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

const base = { nombre: 'Ana', email: 'ana@example.com', tipo: 'DONANTE' };

async function errorsFor(password: unknown) {
  const dto = plainToInstance(RegisterDto, { ...base, password });
  const errors = await validate(dto);
  return errors.filter((e) => e.property === 'password');
}

describe('RegisterDto password bounds (mirror of the MS PasswordPolicy)', () => {
  it('rejects 14 characters with the stable code', async () => {
    const errs = await errorsFor('a'.repeat(13) + 'b');
    expect(errs).toHaveLength(1);
    expect(Object.values(errs[0].constraints ?? {})).toContain(
      'PASSWORD_DEMASIADO_CORTA',
    );
  });

  it('accepts 15 characters', async () => {
    expect(await errorsFor('kq7vbn2xw8zpt4m')).toHaveLength(0);
  });

  it('accepts 64 characters', async () => {
    expect(await errorsFor('k'.repeat(64))).toHaveLength(0);
  });

  it('rejects 65 characters with the stable code', async () => {
    const errs = await errorsFor('k'.repeat(65));
    expect(errs).toHaveLength(1);
    expect(Object.values(errs[0].constraints ?? {})).toContain(
      'PASSWORD_DEMASIADO_LARGA',
    );
  });

  it('applies no composition rules and allows spaces', async () => {
    expect(await errorsFor('la cafetera azul canta')).toHaveLength(0);
  });

  it('does not trim or alter the password', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...base,
      password: '  kq7vbn2xw8zpt4m  ',
    });
    expect(dto.password).toBe('  kq7vbn2xw8zpt4m  ');
  });

  it('rejects a non-string password', async () => {
    expect((await errorsFor(123456789012345)).length).toBeGreaterThan(0);
  });
});
