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
import { ReclamosService } from './reclamos.service.js';
import { CrearReclamoDto } from './dto/crear-reclamo.dto.js';
import { RechazarReclamoDto } from './dto/rechazar-reclamo.dto.js';

/**
 * Claim flow for unclaimed (ReNaCoM) organizaciones — a thin proxy over the MS (the authority).
 * This layer only enforces the role matrix; ownership of a claim is checked MS-side.
 */
@ApiTags('reclamos')
@Controller('reclamos')
export class ReclamosController {
  constructor(private reclamosService: ReclamosService) {}

  private getToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Roles(Role.REFERENTE)
  @Post()
  @ApiOperation({ summary: 'Claim an unclaimed organization (referente only)' })
  crear(@Body() dto: CrearReclamoDto, @Req() req: Request) {
    return this.reclamosService.crear(dto, this.getToken(req));
  }

  @Roles(Role.REFERENTE)
  @Get('mios')
  @ApiOperation({ summary: "List the authenticated referente's own claims" })
  mios(@Req() req: Request) {
    return this.reclamosService.mios(this.getToken(req));
  }

  // Literal routes are declared before ':id' so Nest does not route them as an id.
  @Roles(Role.ADMINISTRADOR)
  @Get('pendientes')
  @ApiOperation({ summary: 'List pending claims (admin only)' })
  pendientes(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('size') size?: string,
    @Query('sort') sort?: string,
  ) {
    return this.reclamosService.pendientes(
      this.getToken(req),
      page,
      size,
      sort,
    );
  }

  @Roles(Role.ADMINISTRADOR, Role.REFERENTE)
  @Get(':id')
  @ApiOperation({ summary: 'Claim detail (admin, or the claimant)' })
  detalle(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.reclamosService.detalle(id, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/aprobar')
  @ApiOperation({
    summary: 'Approve a claim and assign the organization (admin only)',
  })
  aprobar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.reclamosService.aprobar(id, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch(':id/rechazar')
  @ApiOperation({ summary: 'Reject a claim with a reason (admin only)' })
  rechazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RechazarReclamoDto,
    @Req() req: Request,
  ) {
    return this.reclamosService.rechazar(id, dto, this.getToken(req));
  }
}
