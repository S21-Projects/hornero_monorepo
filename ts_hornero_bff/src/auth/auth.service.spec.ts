import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: { axiosRef: { post: jest.Mock } };
  let configService: { get: jest.Mock };
  let res: {
    cookie: jest.Mock;
    clearCookie: jest.Mock;
  };

  beforeEach(async () => {
    httpService = { axiosRef: { post: jest.fn() } };
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
});
