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
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { OrganizacionesService } from './organizaciones.service.js';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto.js';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto.js';
import { ActualizarInfoPublicaDto } from './dto/actualizar-info-publica.dto.js';
import { AsignarReferenteDto } from './dto/asignar-referente.dto.js';

@ApiTags('organizaciones')
@Controller('organizaciones')
export class OrganizacionesController {
  constructor(private organizacionesService: OrganizacionesService) {}

  private getToken(req: Request): string {
    const token = (req as any).cookies?.['access_token'];
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Post()
  @ApiOperation({ summary: 'Propose a new organization (referente only)' })
  crear(@Body() dto: CrearOrganizacionDto, @Req() req: Request) {
    return this.organizacionesService.crear(dto, this.getToken(req));
  }

  @Get('mia')
  @ApiOperation({
    summary: 'Get the organizations of the authenticated referente',
  })
  misOrganizaciones(@Req() req: Request) {
    return this.organizacionesService.misOrganizaciones(this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Get('todas')
  @ApiOperation({
    summary: 'List all organizations, any estado/referente (admin only)',
  })
  listarTodas(@Req() req: Request) {
    return this.organizacionesService.listarTodas(this.getToken(req));
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List validated organizations' })
  listarValidadas(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    const token = (req as any).cookies?.['access_token'] as string | undefined;
    return this.organizacionesService.listarValidadas(token, page, size, sort);
  }

  @Roles(Role.ADMINISTRADOR)
  @Get('pendientes')
  @ApiOperation({ summary: 'List pending organizations (admin only)' })
  listarPendientes(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.organizacionesService.listarPendientes(this.getToken(req), page, size, sort);
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/validar')
  @ApiOperation({ summary: 'Validate an organization (admin only)' })
  validar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.organizacionesService.validar(id, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/rechazar')
  @ApiOperation({ summary: 'Reject an organization (admin only)' })
  rechazar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.organizacionesService.rechazar(id, this.getToken(req));
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get organization by slug (public)' })
  findBySlug(@Param('slug') slug: string) {
    return this.organizacionesService.findBySlug(slug);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization (referente owner only)' })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarOrganizacionDto,
    @Req() req: Request,
  ) {
    return this.organizacionesService.actualizar(id, dto, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/referente')
  @ApiOperation({
    summary: "Reassign or unassign an organization's referente (admin only)",
  })
  asignarReferente(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarReferenteDto,
    @Req() req: Request,
  ) {
    return this.organizacionesService.asignarReferente(
      id,
      dto,
      this.getToken(req),
    );
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/info-publica')
  @ApiOperation({
    summary: 'Directly edit info pública fields, live immediately (admin only)',
  })
  actualizarInfoPublica(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarInfoPublicaDto,
    @Req() req: Request,
  ) {
    return this.organizacionesService.actualizarInfoPublica(
      id,
      dto,
      this.getToken(req),
    );
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/info-publica/aprobar')
  @ApiOperation({
    summary:
      "Approve a referente's pending info pública submission (admin only)",
  })
  aprobarInfoPublica(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.organizacionesService.aprobarInfoPublica(
      id,
      this.getToken(req),
    );
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/info-publica/rechazar')
  @ApiOperation({
    summary:
      "Reject a referente's pending info pública submission (admin only)",
  })
  rechazarInfoPublica(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.organizacionesService.rechazarInfoPublica(
      id,
      this.getToken(req),
    );
  }
}
