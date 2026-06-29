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
import { OrganizacionesService } from './organizaciones.service.js';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto.js';
import { ActualizarOrganizacionDto } from './dto/actualizar-organizacion.dto.js';

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
  @ApiOperation({ summary: 'Get the organization of the authenticated referente' })
  miOrganizacion(@Req() req: Request) {
    return this.organizacionesService.miOrganizacion(this.getToken(req));
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

  @Patch(':id/validar')
  @ApiOperation({ summary: 'Validate an organization (admin only)' })
  validar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.organizacionesService.validar(id, this.getToken(req));
  }

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
}
