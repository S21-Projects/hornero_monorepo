import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
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
