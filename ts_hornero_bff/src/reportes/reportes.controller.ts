import {
  Body,
  Controller,
  Get,
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
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ReportesService } from './reportes.service.js';
import { CrearReporteDto } from './dto/crear-reporte.dto.js';
import { DescartarReporteDto } from './dto/descartar-reporte.dto.js';

/**
 * Report flow for unclaimed (ReNaCoM) organizaciones — a thin proxy over the MS (the authority).
 * Submitting and the nearby lookup take any authenticated session (no @Roles); resolving is admin.
 */
@ApiTags('reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private reportesService: ReportesService) {}

  private getToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Post()
  @ApiOperation({ summary: 'Report an unclaimed organization (any role)' })
  crear(@Body() dto: CrearReporteDto, @Req() req: Request) {
    return this.reportesService.crear(dto, this.getToken(req));
  }

  // Literal routes are declared before ':id' so Nest does not route them as an id.
  @Get('cercanas')
  @ApiOperation({
    summary: 'Hornero organizations within 500 m, for the duplicate picker',
  })
  cercanas(
    @Query('organizacionId', ParseIntPipe) organizacionId: number,
    @Req() req: Request,
  ) {
    return this.reportesService.cercanas(organizacionId, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Get('pendientes')
  @ApiOperation({ summary: 'List pending reports (admin only)' })
  pendientes(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.reportesService.pendientes(
      this.getToken(req),
      page,
      size,
      sort,
    );
  }

  @Roles(Role.ADMINISTRADOR)
  @Get(':id')
  @ApiOperation({ summary: 'Report detail (admin only)' })
  detalle(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.reportesService.detalle(id, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/marcar-inactiva')
  @ApiOperation({
    summary:
      'Mark the organization inactive and confirm its reports (admin only)',
  })
  marcarInactiva(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.reportesService.marcarInactiva(id, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/descartar')
  @ApiOperation({ summary: 'Discard a report with a note (admin only)' })
  descartar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DescartarReporteDto,
    @Req() req: Request,
  ) {
    return this.reportesService.descartar(id, dto, this.getToken(req));
  }
}
