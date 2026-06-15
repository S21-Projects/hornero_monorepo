import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { UsuariosService } from './usuarios.service.js';

@ApiTags('usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(private usuariosService: UsuariosService) {}

  private getToken(req: Request): string {
    const token = (req as any).cookies?.['access_token'];
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Roles(Role.ADMINISTRADOR)
  @Get()
  @ApiOperation({ summary: 'List all users (ADMINISTRADOR only)' })
  findAll(@Req() req: Request) {
    return this.usuariosService.findAll(this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/activo')
  @ApiOperation({ summary: 'Toggle user active status (ADMINISTRADOR only)' })
  toggleActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: object,
    @Req() req: Request,
  ) {
    return this.usuariosService.toggleActivo(id, body, this.getToken(req));
  }

  @Patch('me/photo')
  @ApiOperation({ summary: 'Update the authenticated user photo URL' })
  updatePhoto(@Body() body: { photoUrl: string }, @Req() req: Request) {
    return this.usuariosService.updatePhoto(body.photoUrl, this.getToken(req));
  }
}
