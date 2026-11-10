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
import { CrearDonacionDto } from './dto/crear-donacion.dto.js';
import { DecisionDonacionDto } from './dto/decision-donacion.dto.js';
import { OverrideEstadoDto } from './dto/override-estado.dto.js';
import { UpdateEstadoDonacionDto } from './dto/update-estado-donacion.dto.js';
import { VerificarCodigoDto } from './dto/verificar-codigo.dto.js';
import { DonacionesService } from './donaciones.service.js';

@ApiTags('donaciones')
@Controller('donaciones')
export class DonacionesController {
  constructor(private donacionesService: DonacionesService) {}

  private getToken(req: Request): string {
    const token = (req as any).cookies?.['access_token'];
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  // Optional session for public routes: never throws, the MS decides what the caller may see.
  private getOptionalToken(req: Request): string | undefined {
    return (req as any).cookies?.['access_token'] || undefined;
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List donations, optionally filtered by organization (public)',
  })
  getDonaciones(
    @Req() req: Request,
    @Query('organizacionId') organizacionId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.donacionesService.getDonaciones(
      organizacionId,
      page,
      size,
      sort,
      this.getOptionalToken(req),
    );
  }

  @Roles(Role.DONANTE)
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a donation (DONANTE only)' })
  crear(@Body() dto: CrearDonacionDto, @Req() req: Request) {
    return this.donacionesService.crear(dto, this.getToken(req));
  }

  @Roles(Role.DONANTE)
  @Get('mias')
  @ApiOperation({
    summary: 'Get donations of the authenticated donante (DONANTE only)',
  })
  findMias(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.donacionesService.findMias(
      this.getToken(req),
      page,
      size,
      sort,
    );
  }

  @Roles(Role.REFERENTE)
  @Get('mi-organizacion')
  @ApiOperation({
    summary:
      "Get donations received by the authenticated referente's organization(s) (REFERENTE only)",
  })
  findDeMiOrganizacion(
    @Req() req: Request,
    @Query('organizacionId') organizacionId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
    @Query('estado') estado?: string,
  ) {
    return this.donacionesService.findDeMiOrganizacion(
      this.getToken(req),
      organizacionId,
      page,
      size,
      sort,
      estado,
    );
  }

  @Roles(Role.ADMINISTRADOR)
  @Get('activas')
  @ApiOperation({
    summary:
      'List active (non-terminal) donations, paginated (ADMINISTRADOR only)',
  })
  findActivas(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
    @Query('q') q?: string,
    @Query('estado') estado?: string,
    @Query('estancadas') estancadas?: string,
  ) {
    return this.donacionesService.findActivas(
      this.getToken(req),
      page,
      size,
      sort,
      q,
      estado,
      estancadas,
    );
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a donation by ID (public)' })
  findById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.donacionesService.findById(id, this.getOptionalToken(req));
  }

  @Roles(Role.REFERENTE)
  @Patch(':id/decision')
  @ApiOperation({
    summary: 'Accept or reject an offered donation (REFERENTE only)',
  })
  decidir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionDonacionDto,
    @Req() req: Request,
  ) {
    return this.donacionesService.decidir(id, dto, this.getToken(req));
  }

  @Roles(Role.DONANTE)
  @Patch(':id/estado')
  @ApiOperation({ summary: 'Update donation status (DONANTE only)' })
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoDonacionDto,
    @Req() req: Request,
  ) {
    return this.donacionesService.actualizarEstado(id, dto, this.getToken(req));
  }

  @Roles(Role.DONANTE, Role.REFERENTE)
  @Post(':id/entrega/codigo')
  @HttpCode(201)
  @ApiOperation({
    summary: "Generate this party's own delivery code (DONANTE or REFERENTE)",
  })
  generarCodigoEntrega(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.donacionesService.generarCodigoEntrega(id, this.getToken(req));
  }

  @Roles(Role.DONANTE, Role.REFERENTE)
  @Post(':id/entrega/verificar')
  @HttpCode(200)
  @ApiOperation({
    summary: "Verify the counterpart's delivery code (DONANTE or REFERENTE)",
  })
  verificarCodigoEntrega(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerificarCodigoDto,
    @Req() req: Request,
  ) {
    return this.donacionesService.verificarCodigoEntrega(
      id,
      dto,
      this.getToken(req),
    );
  }

  @Roles(Role.DONANTE, Role.REFERENTE)
  @Get(':id/entrega')
  @ApiOperation({
    summary:
      "Both parties' delivery confirmation status (DONANTE or REFERENTE)",
  })
  estadoEntrega(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.donacionesService.estadoEntrega(id, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/estado-admin')
  @ApiOperation({ summary: 'Override donation status (ADMINISTRADOR only)' })
  overrideEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OverrideEstadoDto,
    @Req() req: Request,
  ) {
    return this.donacionesService.overrideEstado(id, dto, this.getToken(req));
  }

  @Roles(Role.DONANTE)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a donation (DONANTE only)' })
  eliminar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.donacionesService.eliminar(id, this.getToken(req));
  }

  @Roles(Role.DONANTE, Role.REFERENTE, Role.ADMINISTRADOR)
  @Get(':id/asignaciones')
  @ApiOperation({
    summary:
      'Assignment history for a donation (owner donante, involved referente, admin)',
  })
  asignaciones(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.donacionesService.asignaciones(id, this.getToken(req));
  }
}
