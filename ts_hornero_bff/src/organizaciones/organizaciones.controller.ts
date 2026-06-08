import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OrganizacionesService } from './organizaciones.service.js';
import { CrearOrganizacionDto } from './dto/crear-organizacion.dto.js';

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

  @Get()
  @ApiOperation({ summary: 'List validated organizations' })
  listarValidadas(@Req() req: Request) {
    return this.organizacionesService.listarValidadas(this.getToken(req));
  }

  @Get('pendientes')
  @ApiOperation({ summary: 'List pending organizations (admin only)' })
  listarPendientes(@Req() req: Request) {
    return this.organizacionesService.listarPendientes(this.getToken(req));
  }

  @Patch(':id/validar')
  @ApiOperation({ summary: 'Validate an organization (admin only)' })
  validar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.organizacionesService.validar(id, this.getToken(req));
  }
}
