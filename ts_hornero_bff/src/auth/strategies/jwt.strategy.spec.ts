import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const strategy = new JwtStrategy({
    get: () => 'test-secret-at-least-32-characters-long',
  } as unknown as ConfigService);

  it('maps an access token payload to the request user', async () => {
    const user = await strategy.validate({
      sub: 7,
      type: 'access',
      email: 'donante@test.com',
      nombre: 'Donante',
      tipo: 'DONANTE',
      emailVerificado: true,
    });

    expect(user).toEqual({
      userId: 7,
      email: 'donante@test.com',
      nombre: 'Donante',
      tipo: 'DONANTE',
      emailVerificado: true,
    });
  });

  it('rejects a refresh token presented as an access token', async () => {
    await expect(
      strategy.validate({ sub: 7, type: 'refresh' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token without a type claim', async () => {
    await expect(
      strategy.validate({ sub: 7, tipo: 'DONANTE' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
