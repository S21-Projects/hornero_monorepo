import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { AcreditacionService } from './acreditacion.service.js';

/**
 * AD-8 (tesis-core-features, slice 4a), `specs/auditoria-cola-global/spec.md`: the cross-org
 * audit queue, a thin proxy over the MS's dedicated `AuditoriaController`
 * (`/api/auditoria/evidencias`). A sibling of `AcreditacionController` in the same module rather
 * than a route on it, since that controller's base path is `organizaciones/:id` and this endpoint
 * is deliberately cross-org, not scoped to one organizacion.
 */
@ApiTags('auditoria')
@Controller('auditoria')
export class AuditoriaController {
  constructor(private acreditacionService: AcreditacionService) {}

  private getToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  @Roles(Role.ADMINISTRADOR)
  @Get('evidencias')
  @ApiOperation({
    summary: 'List the cross-org audit queue (admin only — AD-8)',
  })
  evidencias(
    @Query('tab') tab: string | undefined,
    @Query('nivel') nivel: string | undefined,
    @Query('requisito') requisito: string | undefined,
    @Query('tipoEvidencia') tipoEvidencia: string | undefined,
    @Query('page') page: string | undefined,
    @Query('size') size: string | undefined,
    @Query('sort') sort: string | undefined,
    @Req() req: Request,
  ) {
    return this.acreditacionService.colaAuditoria(
      { tab, nivel, requisito, tipoEvidencia, page, size, sort },
      this.getToken(req),
    );
  }
}
