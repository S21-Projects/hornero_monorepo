import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { OrganizacionesService } from '../organizaciones/organizaciones.service.js';
import { ActualizarOrganizacionDto } from '../organizaciones/dto/actualizar-organizacion.dto.js';
import { ActualizarInfoPublicaDto } from '../organizaciones/dto/actualizar-info-publica.dto.js';
import { UploadService } from './upload.service.js';
import { ReclamosService } from '../reclamos/reclamos.service.js';
import { ClientIpThrottlerGuard } from '../auth/guards/client-ip-throttler.guard.js';
import { Throttle } from '@nestjs/throttler';

/** Claim evidence uploads allowed per minute and client IP. */
export const RECLAMO_UPLOAD_LIMIT = 10;

interface AuthedRequest extends Request {
  user?: { tipo?: Role; userId?: string };
}

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly organizacionesService: OrganizacionesService,
    private readonly authService: AuthService,
    private readonly reclamosService: ReclamosService,
  ) {}

  @Post('org-profile/:id')
  @Roles(Role.REFERENTE, Role.ADMINISTRADOR)
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary:
      'Upload profile image for an organization (referente owner, or admin moderating any org)',
  })
  @ApiConsumes('multipart/form-data')
  async uploadOrgProfile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ): Promise<{ key: string }> {
    if (!file)
      throw new BadRequestException(
        'Image file is required (jpeg, png, or webp, max 5 MB)',
      );

    await this.assertSesionActiva(req);
    const key = await this.uploadService.uploadOrgProfile(id, file);
    await this.persistKey(id, 'profileImageKey', key, req);

    return { key };
  }

  @Post('org-banner/:id')
  @Roles(Role.REFERENTE, Role.ADMINISTRADOR)
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary:
      'Upload banner image for an organization (referente owner, or admin moderating any org)',
  })
  @ApiConsumes('multipart/form-data')
  async uploadOrgBanner(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ): Promise<{ key: string }> {
    if (!file)
      throw new BadRequestException(
        'Image file is required (jpeg, png, or webp, max 5 MB)',
      );

    await this.assertSesionActiva(req);
    const key = await this.uploadService.uploadOrgBanner(id, file);
    await this.persistKey(id, 'bannerKey', key, req);

    return { key };
  }

  @Post('org-evidencia/:id')
  @Roles(Role.REFERENTE, Role.ADMINISTRADOR)
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary:
      'Upload an accreditation evidence file (referente owner, or admin) — the resulting key is ' +
      'not persisted here; it is submitted through POST /organizaciones/:id/acreditacion/evidencias',
  })
  @ApiConsumes('multipart/form-data')
  async uploadOrgEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ): Promise<{ key: string }> {
    if (!file)
      throw new BadRequestException(
        'Image file is required (jpeg, png, or webp, max 5 MB)',
      );

    await this.assertSesionActiva(req);
    if (req.user?.tipo !== Role.ADMINISTRADOR) {
      await this.assertOwnership(id, this.extractToken(req));
    }

    const key = await this.uploadService.uploadOrgEvidencia(id, file);
    return { key };
  }

  @Post('reclamo-evidencia/:id')
  @Roles(Role.REFERENTE)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: RECLAMO_UPLOAD_LIMIT, ttl: 60_000 } })
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary:
      'Upload a claim evidence file for an unclaimed organization (referente) — the resulting key ' +
      'is not persisted here; it is submitted through POST /reclamos',
  })
  @ApiConsumes('multipart/form-data')
  async uploadReclamoEvidencia(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ): Promise<{ key: string }> {
    if (!file)
      throw new BadRequestException(
        'Image file is required (jpeg, png, or webp, max 5 MB)',
      );

    await this.assertSesionActiva(req);
    // Nothing reaches storage unless the MS says this referente could claim this organizacion now.
    await this.reclamosService.verificarReclamable(id, this.extractToken(req));
    const userId = Number(req.user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new UnauthorizedException('Invalid session');
    }

    const key = await this.uploadService.uploadReclamoEvidencia(
      id,
      userId,
      file,
    );
    return { key };
  }

  /**
   * N9: uploads write to S3 before (or without) any MS call, so a deactivated user's still-valid
   * token must be refused by the MS first.
   */
  private async assertSesionActiva(req: Request): Promise<void> {
    await this.authService.verificarSesion(this.extractToken(req));
  }

  private extractToken(req: Request): string {
    const token = (req as any).cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  /**
   * Referentes can only touch their own org (ownership-checked, live PATCH).
   * Admins bypass ownership and write via the admin-only info-pública
   * endpoint, since the generic PATCH /organizaciones/:id is referente-only
   * at the MS.
   */
  private async persistKey(
    orgId: number,
    field: 'profileImageKey' | 'bannerKey',
    key: string,
    req: AuthedRequest,
  ): Promise<void> {
    const token = this.extractToken(req);

    if (req.user?.tipo === Role.ADMINISTRADOR) {
      const dto = new ActualizarInfoPublicaDto();
      dto[field] = key;
      await this.organizacionesService.actualizarInfoPublica(orgId, dto, token);
      return;
    }

    await this.assertOwnership(orgId, token);
    const dto = new ActualizarOrganizacionDto();
    dto[field] = key;
    await this.organizacionesService.actualizar(orgId, dto, token);
  }

  private async assertOwnership(orgId: number, token: string): Promise<void> {
    const body: unknown =
      await this.organizacionesService.misOrganizaciones(token);
    // The MS wraps every response as { status, message, data, ... }; tolerate a bare array too.
    const orgs =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as { data?: unknown }).data
        : body;
    const owns =
      Array.isArray(orgs) &&
      orgs.some((org: { id: number }) => org?.id === orgId);
    if (!owns) throw new ForbiddenException('You do not own this organization');
  }
}
