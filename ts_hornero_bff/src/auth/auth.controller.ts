import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResendOtpDto } from './dto/resend-otp.dto.js';
import { Public } from './decorators/public.decorator.js';
import { ClientIpThrottlerGuard } from './guards/client-ip-throttler.guard.js';
import { AUTH_LIMITS, authThrottle } from './auth-throttler.config.js';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ClientIpThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Throttle(authThrottle(AUTH_LIMITS.register))
  @Post('register')
  @ApiOperation({ summary: 'Register a new referente or donante account' })
  @ApiOkResponse({ description: 'Sets access_token and refresh_token cookies, returns user' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(dto, res);
  }

  @Public()
  @Throttle(authThrottle(AUTH_LIMITS.login))
  @Post('login')
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({ description: 'Sets access_token and refresh_token cookies' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(dto, res);
  }

  @Public()
  @Throttle(authThrottle(AUTH_LIMITS.refresh))
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using the refresh_token cookie' })
  @ApiCookieAuth('access_token')
  @ApiOkResponse({ description: 'Issues a new access_token cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req as any).cookies?.['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException();
    return this.authService.refresh(refreshToken, res);
  }

  @Public()
  @Throttle(authThrottle(AUTH_LIMITS.verifyOtp))
  @Post('verify-otp')
  @ApiOperation({ summary: 'Confirm an OTP and mark the account as email-verified' })
  @ApiOkResponse({ description: 'Sets refreshed access_token and refresh_token cookies, returns user' })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifyOtp(dto, res);
  }

  @Public()
  @Throttle(authThrottle(AUTH_LIMITS.resendOtp))
  @Post('resend-otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resend a fresh OTP (always 204, no enumeration oracle)' })
  @ApiNoContentResponse({ description: 'A new OTP was requested, if the email exists' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    await this.authService.resendOtp(dto);
  }

  @Public()
  @SkipThrottle()
  @Post('logout')
  @ApiOperation({ summary: 'Clear auth cookies and end the session' })
  @ApiOkResponse({ description: 'Cookies cleared' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout((req as any).cookies?.['refresh_token'], res);
    return { message: 'ok' };
  }

  @SkipThrottle()
  @Get('me')
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('access_token')
  @ApiOkResponse({ description: 'Current user payload from the JWT' })
  async me(@Req() req: any) {
    // N9: the payload comes from the token, so ask the MS whether the user is still active.
    const token = req.cookies?.['access_token'];
    if (!token) throw new UnauthorizedException();
    await this.authService.verificarSesion(token);
    return req.user;
  }
}
