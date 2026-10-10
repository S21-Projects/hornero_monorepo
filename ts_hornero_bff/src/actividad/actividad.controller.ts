import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ActividadService } from './actividad.service.js';
import type { ActividadFiltros } from './actividad.service.js';

/** Read-only: the activity log has no write route anywhere (ASVS 16.4.2). */
@ApiTags('actividad')
@Controller('actividad')
export class ActividadController {
  constructor(private actividadService: ActividadService) {}

  private getToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Roles(Role.ADMINISTRADOR)
  @Get()
  @ApiOperation({ summary: 'Query the activity log (ADMINISTRADOR only)' })
  listar(@Req() req: Request, @Query() query: ActividadFiltros) {
    return this.actividadService.listar(this.getToken(req), query);
  }
}
