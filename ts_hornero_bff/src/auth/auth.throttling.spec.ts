import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AxiosExceptionFilter } from '../common/axios-exception.filter';
import { AUTH_THROTTLER_OPTIONS } from './auth-throttler.config';

describe('AuthController rate limiting', () => {
  let app: INestApplication;
  const authService = {
    login: jest.fn().mockResolvedValue({ ok: true }),
    register: jest.fn().mockResolvedValue({ ok: true }),
    refresh: jest.fn().mockResolvedValue({ ok: true }),
    verifyOtp: jest.fn().mockResolvedValue({ ok: true }),
    resendOtp: jest.fn().mockResolvedValue(undefined),
    olvidoPassword: jest.fn().mockResolvedValue({ mensaje: 'ok' }),
    restablecerPassword: jest.fn().mockResolvedValue({ mensaje: 'ok' }),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(AUTH_THROTTLER_OPTIONS)],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AxiosExceptionFilter());
    await app.init();
  });

  afterEach(() => app.close());

  const body = { email: 'a@b.ar', password: 'secret1' };
  const post = (path: string, ip = '203.0.113.7', payload: object = body) =>
    request(app.getHttpServer())
      .post(path)
      .set('cf-connecting-ip', ip)
      .set('Cookie', 'refresh_token=abc')
      .send(payload);

  it.each([
    ['/auth/login', 5, body],
    ['/auth/register', 3, { ...body, nombre: 'N', tipo: 'DONANTE' }],
    ['/auth/refresh', 20, {}],
    ['/auth/verify-otp', 5, { email: 'a@b.ar', codigo: '123456' }],
    ['/auth/resend-otp', 3, { email: 'a@b.ar' }],
    ['/auth/password/olvido', 3, { email: 'a@b.ar' }],
    [
      '/auth/password/restablecer',
      5,
      { token: 't', password: 'la cafetera azul canta fuerte' },
    ],
  ])(
    '%s answers 429 with the error envelope after %i requests',
    async (path, limit, payload) => {
      for (let i = 0; i < limit; i += 1) {
        const res = await post(path, '203.0.113.7', payload);
        expect(res.status).not.toBe(429);
      }
      const blocked = await post(path, '203.0.113.7', payload);
      expect(blocked.status).toBe(429);
      expect(blocked.body).toEqual(
        expect.objectContaining({
          status: 429,
          data: null,
          errors: expect.any(Array),
        }),
      );
    },
  );

  it('counts each client IP separately', async () => {
    for (let i = 0; i < 5; i += 1) await post('/auth/login', '203.0.113.7');
    expect((await post('/auth/login', '203.0.113.7')).status).toBe(429);
    expect((await post('/auth/login', '198.51.100.9')).status).not.toBe(429);
  });

  it('answers 202 for olvido and 200 for restablecer', async () => {
    expect((await post('/auth/password/olvido', '198.51.100.1', { email: 'a@b.ar' })).status).toBe(202);
    expect(
      (await post('/auth/password/restablecer', '198.51.100.2', { token: 't', password: 'x' })).status,
    ).toBe(200);
  });

  it('does not throttle logout', async () => {
    for (let i = 0; i < 30; i += 1) {
      expect((await post('/auth/logout')).status).not.toBe(429);
    }
  });
});
