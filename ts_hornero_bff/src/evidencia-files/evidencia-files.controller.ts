import {
  Controller,
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
import { AcreditacionService } from '../acreditacion/acreditacion.service.js';

/**
 * The authenticated, ownership-checked replacement for reading `org-evidencia/` objects
 * (`specs/organizacion-evidencia/spec.md` "Authenticated Evidence-File Access"). The public
 * `GET /images?key=` route keeps rejecting this prefix unconditionally — this route is the only
 * supported way in.
 *
 * AD-12 (tesis-core-features slice 2, decision 13): a syntactically valid key with no matching
 * `OrganizacionEvidencia` row is also rejected, so authorization is delegated to the MS through
 * `AcreditacionService.verificarArchivoEvidencia` for EVERY role, including ADMINISTRADOR — the MS
 * check is strictly stronger (ownership + row) than the BFF's former `misOrganizaciones` shortcut.
 */
@ApiTags('evidencia-files')
@Controller('evidencia-files')
export class EvidenciaFilesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly acreditacionService: AcreditacionService,
  ) {}

  @Roles(Role.REFERENTE, Role.ADMINISTRADOR)
  @Get(':orgId/:filename')
  @ApiOperation({
    summary:
      'Stream an evidence file bound to an existing row (owning referente or any admin)',
  })
  @ApiParam({ name: 'orgId', description: 'Organizacion id' })
  @ApiParam({ name: 'filename', description: 'Evidence object filename' })
  async serve(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const key = `org-evidencia/${orgId}/${filename}`;
    await this.acreditacionService.verificarArchivoEvidencia(
      orgId,
      key,
      this.extractToken(req),
    );

    const { body, contentType } = await this.imagesService.getObject(key);
    res.set('Content-Type', contentType ?? 'application/octet-stream');
    return new StreamableFile(body);
  }

  private extractToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }
}
