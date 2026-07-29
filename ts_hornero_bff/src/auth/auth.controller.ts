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
} from '@nestjs/common';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
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
  @Post('resend-otp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resend a fresh OTP (always 204, no enumeration oracle)' })
  @ApiNoContentResponse({ description: 'A new OTP was requested, if the email exists' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    await this.authService.resendOtp(dto);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Clear auth cookies and end the session' })
  @ApiOkResponse({ description: 'Cookies cleared' })
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.logout(res);
    return { message: 'ok' };
  }

  @Get('me')
  @ApiOperation({ summary: 'Return the currently authenticated user' })
  @ApiBearerAuth('access-token')
  @ApiCookieAuth('access_token')
  @ApiOkResponse({ description: 'Current user payload from the JWT' })
  me(@Req() req: any) {
    return req.user;
  }
}
