import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { ImagesService } from '../images/images.service.js';
import { OrganizacionesService } from '../organizaciones/organizaciones.service.js';

interface AuthedRequest extends Request {
  user?: { tipo?: Role };
}

/**
 * The authenticated, ownership-checked replacement for reading `org-evidencia/` objects
 * (`specs/organizacion-evidencia/spec.md` "Authenticated Evidence-File Access"). The public
 * `GET /images?key=` route keeps rejecting this prefix unconditionally — this route is the only
 * supported way in. An ADMINISTRADOR reads any organizacion's file; a REFERENTE only their own,
 * checked the same way `UploadController.assertOwnership` already does (`misOrganizaciones`).
 */
@ApiTags('evidencia-files')
@Controller('evidencia-files')
export class EvidenciaFilesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly organizacionesService: OrganizacionesService,
  ) {}

  @Roles(Role.REFERENTE, Role.ADMINISTRADOR)
  @Get(':orgId/:filename')
  @ApiOperation({
    summary: 'Stream an evidence file (owning referente or any admin)',
  })
  @ApiParam({ name: 'orgId', description: 'Organizacion id' })
  @ApiParam({ name: 'filename', description: 'Evidence object filename' })
  async serve(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('filename') filename: string,
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (req.user?.tipo !== Role.ADMINISTRADOR) {
      await this.assertOwnership(orgId, this.extractToken(req));
    }

    const key = `org-evidencia/${orgId}/${filename}`;
    const { body, contentType } = await this.imagesService.getObject(key);
    res.set('Content-Type', contentType ?? 'application/octet-stream');
    return new StreamableFile(body);
  }

  private extractToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  private async assertOwnership(orgId: number, token: string): Promise<void> {
    const orgs = await this.organizacionesService.misOrganizaciones(token);
    const owns =
      Array.isArray(orgs) &&
      orgs.some((org: { id: number }) => org.id === orgId);
    if (!owns) throw new ForbiddenException('You do not own this organization');
  }
}
