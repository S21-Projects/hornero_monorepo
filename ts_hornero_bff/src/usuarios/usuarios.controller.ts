import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { UsuariosService } from './usuarios.service.js';
import { ToggleActivoDto } from './dto/toggle-activo.dto.js';

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
  findAll(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.usuariosService.findAll(this.getToken(req), page, size, sort);
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/activo')
  @ApiOperation({ summary: 'Toggle user active status (ADMINISTRADOR only)' })
  toggleActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ToggleActivoDto,
    @Req() req: Request,
  ) {
    return this.usuariosService.toggleActivo(id, body, this.getToken(req));
  }
}
