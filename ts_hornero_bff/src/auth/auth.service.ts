import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
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

  logout(res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
  }

  private setCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', accessToken, {
      httpOnly: false,
      sameSite: 'strict',
      secure: isProd,
      maxAge: 900 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProd,
      maxAge: 604800 * 1000,
    });
  }
}
