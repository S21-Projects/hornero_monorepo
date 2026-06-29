import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ActualizarNecesidadDto } from './dto/actualizar-necesidad.dto.js';
import { CrearNecesidadDto } from './dto/crear-necesidad.dto.js';
import { NecesidadesService } from './necesidades.service.js';

@ApiTags('necesidades')
@Controller('necesidades')
export class NecesidadesController {
  constructor(private necesidadesService: NecesidadesService) {}

  private getToken(req: Request): string {
    const token = (req as any).cookies?.['access_token'];
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List needs, optionally filtered by organization (public)' })
  getNecesidades(
    @Query('organizacionId') organizacionId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.necesidadesService.getNecesidades(organizacionId, page, size, sort);
  }

  @Roles(Role.REFERENTE)
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a need for the authenticated referente (REFERENTE only)' })
  crear(@Body() dto: CrearNecesidadDto, @Req() req: Request) {
    return this.necesidadesService.crear(dto, this.getToken(req));
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a need by ID (public)' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.necesidadesService.findById(id);
  }

  @Roles(Role.REFERENTE)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a need (REFERENTE only)' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarNecesidadDto,
    @Req() req: Request,
  ) {
    return this.necesidadesService.actualizar(id, dto, this.getToken(req));
  }

  @Roles(Role.REFERENTE)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a need (REFERENTE only)' })
  eliminar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.necesidadesService.eliminar(id, this.getToken(req));
  }
}
