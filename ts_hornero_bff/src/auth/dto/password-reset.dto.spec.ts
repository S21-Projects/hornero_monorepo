import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PasswordOlvidoDto } from './password-olvido.dto';
import { PasswordRestablecerDto } from './password-restablecer.dto';

async function errorsFor<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
  property: string,
) {
  const errors = await validate(plainToInstance(cls, plain));
  return errors.filter((e) => e.property === property);
}

describe('PasswordOlvidoDto', () => {
  it('accepts an email', async () => {
    expect(
      await errorsFor(PasswordOlvidoDto, { email: 'ana@example.com' }, 'email'),
    ).toHaveLength(0);
  });

  it.each([undefined, '', 'no-es-email', 42])('rejects %p', async (email) => {
    expect(
      (await errorsFor(PasswordOlvidoDto, { email }, 'email')).length,
    ).toBeGreaterThan(0);
  });
});

describe('PasswordRestablecerDto', () => {
  const token = 'a'.repeat(43);
  const password = 'la cafetera azul canta fuerte';

  it('accepts a token and a 15..64 char password', async () => {
    const dto = plainToInstance(PasswordRestablecerDto, { token, password });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing or non-string token', async () => {
    expect(
      (await errorsFor(PasswordRestablecerDto, { password }, 'token')).length,
    ).toBeGreaterThan(0);
    expect(
      (await errorsFor(PasswordRestablecerDto, { token: 5, password }, 'token'))
        .length,
    ).toBeGreaterThan(0);
  });

  it('rejects an oversized token', async () => {
    expect(
      (
        await errorsFor(
          PasswordRestablecerDto,
          { token: 'a'.repeat(201), password },
          'token',
        )
      ).length,
    ).toBeGreaterThan(0);
  });

  it('rejects 14 characters with the stable code', async () => {
    const errs = await errorsFor(
      PasswordRestablecerDto,
      { token, password: 'a'.repeat(14) },
      'password',
    );
    expect(Object.values(errs[0].constraints ?? {})).toContain(
      'PASSWORD_DEMASIADO_CORTA',
    );
  });

  it('rejects 65 characters with the stable code', async () => {
    const errs = await errorsFor(
      PasswordRestablecerDto,
      { token, password: 'k'.repeat(65) },
      'password',
    );
    expect(Object.values(errs[0].constraints ?? {})).toContain(
      'PASSWORD_DEMASIADO_LARGA',
    );
  });

  it('does not trim or alter the password', () => {
    const dto = plainToInstance(PasswordRestablecerDto, {
      token,
      password: '  kq7vbn2xw8zpt4m  ',
    });
    expect(dto.password).toBe('  kq7vbn2xw8zpt4m  ');
  });
});
