import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { RondasService } from './rondas.service.js';

/**
 * AD-9 (tesis-core-features, slice 5d), `specs/ronda-asignacion/spec.md`: manual ronda trigger and
 * history, ADMINISTRADOR-only at every route — there is no scheduler and no per-donation
 * automatic trigger. `fondo` is declared before `:id` so Express matches the literal path first.
 */
@ApiTags('rondas')
@Controller('rondas')
export class RondasController {
  constructor(private rondasService: RondasService) {}

  private getToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Roles(Role.ADMINISTRADOR)
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Trigger a ronda (admin only — AD-9)' })
  ejecutar(@Req() req: Request) {
    return this.rondasService.ejecutar(this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Get()
  @ApiOperation({
    summary: 'List prior rondas, most recent first (admin only)',
  })
  listar(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.rondasService.listar(this.getToken(req), page, size, sort);
  }

  @Roles(Role.ADMINISTRADOR)
  @Get('fondo')
  @ApiOperation({
    summary:
      'Pool size and the oldest waiting donación, before triggering a ronda (admin only)',
  })
  fondo(@Req() req: Request) {
    return this.rondasService.fondo(this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Get(':id')
  @ApiOperation({ summary: "A ronda's full detail (admin only)" })
  detalle(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.rondasService.detalle(id, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Get(':id/asignaciones')
  @ApiOperation({
    summary: 'Assignments produced by one ronda, best score first (admin only)',
  })
  asignaciones(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.rondasService.asignaciones(id, this.getToken(req));
  }
}
