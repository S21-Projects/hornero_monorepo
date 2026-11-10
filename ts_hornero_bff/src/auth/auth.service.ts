import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResendOtpDto } from './dto/resend-otp.dto.js';
import { PasswordOlvidoDto } from './dto/password-olvido.dto.js';
import { PasswordRestablecerDto } from './dto/password-restablecer.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto, res: Response) {
    const javaUrl = this.configService.get<string>('JAVA_MS_URL');
    const { data } = await this.httpService.axiosRef.post(
      `${javaUrl}/api/auth/register`,
      registerDto,
    );
    this.setCookies(res, data.accessToken, data.refreshToken);
    return { user: data.user };
  }

  async login(loginDto: LoginDto, res: Response) {
    const javaUrl = this.configService.get<string>('JAVA_MS_URL');
    const { data } = await this.httpService.axiosRef.post(
      `${javaUrl}/api/auth/login`,
      loginDto,
    );
    this.setCookies(res, data.accessToken, data.refreshToken);
    return { user: data.user };
  }

  async refresh(refreshToken: string, res: Response) {
    const javaUrl = this.configService.get<string>('JAVA_MS_URL');
    const { data } = await this.httpService.axiosRef.post(
      `${javaUrl}/api/auth/refresh`,
      { refreshToken },
    );
    this.setCookies(res, data.accessToken, data.refreshToken);
    return { user: data.user };
  }

  async verifyOtp(dto: VerifyOtpDto, res: Response) {
    const javaUrl = this.configService.get<string>('JAVA_MS_URL');
    const { data } = await this.httpService.axiosRef.post(
      `${javaUrl}/api/auth/verify-otp`,
      dto,
    );
    this.setCookies(res, data.accessToken, data.refreshToken);
    return { user: data.user };
  }

  async resendOtp(dto: ResendOtpDto) {
    const javaUrl = this.configService.get<string>('JAVA_MS_URL');
    await this.httpService.axiosRef.post(`${javaUrl}/api/auth/resend-otp`, dto);
  }

  /** N14: the MS answers the same generic body whether or not the email exists; relay it as is. */
  async olvidoPassword(dto: PasswordOlvidoDto) {
    const javaUrl = this.configService.get<string>('JAVA_MS_URL');
    const { data } = await this.httpService.axiosRef.post(
      `${javaUrl}/api/auth/password/olvido`,
      dto,
    );
    return data;
  }

  /** N14: no cookies are set; the MS revokes every session, so the user logs in again. */
  async restablecerPassword(dto: PasswordRestablecerDto) {
    const javaUrl = this.configService.get<string>('JAVA_MS_URL');
    const { data } = await this.httpService.axiosRef.post(
      `${javaUrl}/api/auth/password/restablecer`,
      dto,
    );
    return data;
  }

  /**
   * N9: the BFF validates JWTs locally, so a deactivated user's still-valid access token would pass
   * every route that answers without calling the MS. Those routes call this first: the MS
   * (JwtAuthFilter) refuses the token with 401 USUARIO_INACTIVO, which the exception filter
   * relays unchanged.
   */
  async verificarSesion(accessToken: string) {
    const javaUrl = this.configService.get<string>('JAVA_MS_URL');
    const { data } = await this.httpService.axiosRef.get(
      `${javaUrl}/api/auth/me`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return data;
  }

  async logout(refreshToken: string | undefined, res: Response) {
    if (refreshToken) {
      // Best effort: the session must end locally even if the MS is unreachable.
      try {
        const javaUrl = this.configService.get<string>('JAVA_MS_URL');
        await this.httpService.axiosRef.post(`${javaUrl}/api/auth/logout`, {
          refreshToken,
        });
      } catch (error) {
        this.logger.warn(
          `Refresh token revocation failed: ${(error as Error).message}`,
        );
      }
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.clearCookie('session_hint');
  }

  private setCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSite = isProd ? 'none' : 'lax';
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      sameSite,
      secure: isProd,
      maxAge: 900 * 1000,
    });
    res.cookie('session_hint', '1', {
      httpOnly: false,
      sameSite,
      secure: isProd,
      maxAge: 900 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite,
      secure: isProd,
      maxAge: 604800 * 1000,
    });
  }
}
