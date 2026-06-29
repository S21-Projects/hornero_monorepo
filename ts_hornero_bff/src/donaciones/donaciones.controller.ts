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
import { UpdateEstadoDonacionDto } from './dto/update-estado-donacion.dto.js';
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

  @Public()
  @Get()
  @ApiOperation({ summary: 'List donations, optionally filtered by organization (public)' })
  getDonaciones(
    @Query('organizacionId') organizacionId?: string,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.donacionesService.getDonaciones(organizacionId, page, size, sort);
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
  @ApiOperation({ summary: 'Get donations of the authenticated donante (DONANTE only)' })
  findMias(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.donacionesService.findMias(this.getToken(req), page, size, sort);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a donation by ID (public)' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.donacionesService.findById(id);
  }

  @Roles(Role.REFERENTE)
  @Patch(':id/estado')
  @ApiOperation({ summary: 'Update donation status (REFERENTE only)' })
  actualizarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoDonacionDto,
    @Req() req: Request,
  ) {
    return this.donacionesService.actualizarEstado(id, dto, this.getToken(req));
  }

  @Roles(Role.DONANTE)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a donation (DONANTE only)' })
  eliminar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.donacionesService.eliminar(id, this.getToken(req));
  }
}
