import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: { axiosRef: { post: jest.Mock; get: jest.Mock } };
  let configService: { get: jest.Mock };
  let res: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };

  beforeEach(async () => {
    httpService = { axiosRef: { post: jest.fn(), get: jest.fn() } };
    configService = { get: jest.fn().mockReturnValue('http://ms:8081') };
    res = { cookie: jest.fn(), clearCookie: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: HttpService, useValue: httpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('verificarSesion (N9: BFF routes that never reach the MS)', () => {
    it('asks the MS /me with the access token as Bearer', async () => {
      httpService.axiosRef.get.mockResolvedValue({ data: { id: 1 } });

      await service.verificarSesion('tok');

      expect(httpService.axiosRef.get).toHaveBeenCalledWith(
        'http://ms:8081/api/auth/me',
        { headers: { Authorization: 'Bearer tok' } },
      );
    });

    it('propagates the MS rejection (401 USUARIO_INACTIVO) untouched', async () => {
      const err = new Error('inactive');
      httpService.axiosRef.get.mockRejectedValue(err);

      await expect(service.verificarSesion('tok')).rejects.toBe(err);
    });
  });

  describe('verifyOtp', () => {
    it('proxies to the MS and re-issues cookies from the fresh tokens', async () => {
      const data = {
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        user: { id: 1, email: 'ana@example.com', emailVerificado: true },
      };
      httpService.axiosRef.post.mockResolvedValue({ data });

      const result = await service.verifyOtp(
        { email: 'ana@example.com', codigo: '123456' },
        res as any,
      );

      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        'http://ms:8081/api/auth/verify-otp',
        { email: 'ana@example.com', codigo: '123456' },
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'new-access',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).toEqual({ user: data.user });
    });
  });

  describe('resendOtp', () => {
    it('proxies to the MS without touching cookies', async () => {
      httpService.axiosRef.post.mockResolvedValue({ data: undefined });

      await service.resendOtp({ email: 'ana@example.com' });

      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        'http://ms:8081/api/auth/resend-otp',
        { email: 'ana@example.com' },
      );
      expect(res.cookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the refresh token at the MS and clears the cookies', async () => {
      httpService.axiosRef.post.mockResolvedValue({ data: undefined });

      await service.logout('the-refresh', res as any);

      expect(httpService.axiosRef.post).toHaveBeenCalledWith(
        'http://ms:8081/api/auth/logout',
        { refreshToken: 'the-refresh' },
      );
      expect(res.clearCookie).toHaveBeenCalledWith('access_token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(res.clearCookie).toHaveBeenCalledWith('session_hint');
    });

    it('still clears the cookies when the MS call fails', async () => {
      httpService.axiosRef.post.mockRejectedValue(new Error('ms down'));

      await expect(
        service.logout('the-refresh', res as any),
      ).resolves.toBeUndefined();

      expect(res.clearCookie).toHaveBeenCalledWith('access_token');
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
      expect(res.clearCookie).toHaveBeenCalledWith('session_hint');
    });

    it('skips the MS call when there is no refresh cookie', async () => {
      await service.logout(undefined, res as any);

      expect(httpService.axiosRef.post).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token');
    });
  });
});
