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
import { AcreditacionService } from './acreditacion.service.js';
import { CargarEvidenciaDto } from './dto/cargar-evidencia.dto.js';
import { AuditarEvidenciaDto } from './dto/auditar-evidencia.dto.js';
import { CambiarNivelDto } from './dto/cambiar-nivel.dto.js';

/**
 * Thin proxy over the MS's `AcreditacionController` — same six routes, same path shape
 * (`/organizaciones/{id}/...`), no `/api` prefix (only the MS has one). Ownership of `{id}` is
 * enforced MS-side (D-01: ADMINISTRADOR or the owning REFERENTE for the two GET routes); this
 * layer only enforces the role matrix and forwards the cookie as a Bearer header
 * (`organizaciones.controller.ts` precedent).
 */
@ApiTags('acreditacion')
@Controller('organizaciones/:id')
export class AcreditacionController {
  constructor(private acreditacionService: AcreditacionService) {}

  private getToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Roles(Role.ADMINISTRADOR, Role.REFERENTE)
  @Get('acreditacion')
  @ApiOperation({
    summary: 'Get the current accreditation level (admin or owning referente)',
  })
  acreditacion(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.acreditacionService.acreditacion(id, this.getToken(req));
  }

  @Roles(Role.REFERENTE)
  @Post('acreditacion/evidencias')
  @ApiOperation({
    summary: 'Submit evidence for a requisito (owning referente only)',
  })
  cargarEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CargarEvidenciaDto,
    @Req() req: Request,
  ) {
    return this.acreditacionService.cargarEvidencia(
      id,
      dto,
      this.getToken(req),
    );
  }

  @Roles(Role.ADMINISTRADOR)
  @Get('acreditacion/evidencias')
  @ApiOperation({
    summary:
      'List the organizacion evidence for the audit queue (admin only — D-02)',
  })
  evidencias(
    @Param('id', ParseIntPipe) id: number,
    @Query('estado') estado: string | undefined,
    @Req() req: Request,
  ) {
    return this.acreditacionService.evidencias(id, estado, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch('acreditacion/evidencias/:evId/aprobar')
  @ApiOperation({ summary: 'Approve a pending evidence row (admin only)' })
  aprobarEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @Param('evId', ParseIntPipe) evId: number,
    @Req() req: Request,
  ) {
    return this.acreditacionService.aprobarEvidencia(
      id,
      evId,
      this.getToken(req),
    );
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch('acreditacion/evidencias/:evId/observar')
  @ApiOperation({
    summary: 'Observe (flag) a pending evidence row with a reason (admin only)',
  })
  observarEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @Param('evId', ParseIntPipe) evId: number,
    @Body() dto: AuditarEvidenciaDto,
    @Req() req: Request,
  ) {
    return this.acreditacionService.observarEvidencia(
      id,
      evId,
      dto,
      this.getToken(req),
    );
  }

  @Roles(Role.ADMINISTRADOR)
  @Patch('acreditacion/nivel')
  @ApiOperation({
    summary: 'Raise or lower the accreditation level (admin only)',
  })
  cambiarNivel(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarNivelDto,
    @Req() req: Request,
  ) {
    return this.acreditacionService.cambiarNivel(id, dto, this.getToken(req));
  }

  @Roles(Role.ADMINISTRADOR, Role.REFERENTE)
  @Get('legajo')
  @ApiOperation({
    summary: 'Export the full legajo (admin or owning referente — D-01)',
  })
  legajo(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.acreditacionService.legajo(id, this.getToken(req));
  }
}
