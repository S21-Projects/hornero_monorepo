import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ActualizarArticuloDto } from './dto/actualizar-articulo.dto.js';
import { CrearArticuloDto } from './dto/crear-articulo.dto.js';
import { ArticulosService } from './articulos.service.js';

@ApiTags('articulos')
@Controller('articulos')
export class ArticulosController {
  constructor(private articulosService: ArticulosService) {}

  private getToken(req: Request): string {
    const token = (req as any).cookies?.['access_token'];
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List catalog items, active only by default (public)',
  })
  listar(@Query('incluirInactivos') incluirInactivos?: string) {
    return this.articulosService.listar(incluirInactivos === 'true');
  }

  @Roles(Role.ADMINISTRADOR)
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a catalog item (ADMINISTRADOR only)' })
  crear(@Body() dto: CrearArticuloDto, @Req() req: Request) {
    return this.articulosService.crear(dto, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Put(':id')
  @ApiOperation({
    summary:
      "Edit a catalog item's nombre/categoria/unidad (ADMINISTRADOR only)",
  })
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarArticuloDto,
    @Req() req: Request,
  ) {
    return this.articulosService.actualizar(id, dto, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/desactivar')
  @ApiOperation({
    summary:
      'Deactivate a catalog item, never a hard delete (ADMINISTRADOR only)',
  })
  desactivar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.articulosService.desactivar(id, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/reactivar')
  @ApiOperation({
    summary:
      'Reactivate a previously deactivated catalog item (ADMINISTRADOR only)',
  })
  reactivar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.articulosService.reactivar(id, this.getToken(req));
  }
}
