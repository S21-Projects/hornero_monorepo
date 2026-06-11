import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { CrearNecesidadDto } from './dto/crear-necesidad.dto.js';
import { NecesidadesService } from './necesidades.service.js';

@ApiTags('necesidades')
@Controller('necesidades')
export class NecesidadesController {
  constructor(private necesidadesService: NecesidadesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List needs, optionally filtered by organization (public)' })
  getNecesidades(@Query('organizacionId') organizacionId?: string) {
    return this.necesidadesService.getNecesidades(organizacionId);
  }

  @Roles(Role.REFERENTE)
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a need for the authenticated referente (REFERENTE only)' })
  crear(@Body() dto: CrearNecesidadDto, @Req() req: Request) {
    const accessToken = (req as any).cookies?.access_token as string;
    return this.necesidadesService.crear(dto, accessToken);
  }
}
