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
import { ReclamosService } from './reclamos.service.js';

/**
 * Authenticated replacement for reading `reclamo-evidencia/` objects (the public `GET /images`
 * route denies that prefix). Authorization is delegated to the MS for every role: the key must be
 * bound to an existing claim of `solicitanteId`, requested by an admin or by that claimant.
 */
@ApiTags('reclamo-files')
@Controller('reclamo-files')
export class ReclamoFilesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly reclamosService: ReclamosService,
  ) {}

  @Roles(Role.REFERENTE, Role.ADMINISTRADOR)
  @Get(':orgId/:solicitanteId/:filename')
  @ApiOperation({
    summary:
      'Stream a claim evidence file (admin, or the claimant who uploaded it)',
  })
  @ApiParam({ name: 'orgId', description: 'Organizacion id' })
  @ApiParam({ name: 'solicitanteId', description: 'Claimant (referente) id' })
  @ApiParam({ name: 'filename', description: 'Evidence object filename' })
  async serve(
    @Param('orgId', ParseIntPipe) orgId: number,
    @Param('solicitanteId', ParseIntPipe) solicitanteId: number,
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const key = `reclamo-evidencia/${orgId}/${solicitanteId}/${filename}`;
    await this.reclamosService.verificarArchivo(
      orgId,
      solicitanteId,
      key,
      this.extractToken(req),
    );

    const { body, contentType } = await this.imagesService.getObject(key);
    res.set('Content-Type', contentType ?? 'application/octet-stream');
    // Personal evidence: never stored by the browser or a shared cache such as Cloudflare.
    res.set('Cache-Control', 'private, no-store');
    return new StreamableFile(body);
  }

  private extractToken(req: Request): string {
    const token = req.cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }
}
