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
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';
import { OrganizacionesService } from '../organizaciones/organizaciones.service.js';
import { ActualizarOrganizacionDto } from '../organizaciones/dto/actualizar-organizacion.dto.js';
import { UploadService } from './upload.service.js';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly organizacionesService: OrganizacionesService,
  ) {}

  @Post('org-profile/:id')
  @Roles(Role.REFERENTE)
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload profile image for an organization (referente owner only)' })
  @ApiConsumes('multipart/form-data')
  async uploadOrgProfile(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ key: string }> {
    if (!file) throw new BadRequestException('Image file is required (jpeg, png, or webp, max 5 MB)');

    const token = this.extractToken(req);
    await this.assertOwnership(id, token);

    const key = await this.uploadService.uploadOrgProfile(id, file);

    const dto = new ActualizarOrganizacionDto();
    dto.profileImageKey = key;
    await this.organizacionesService.actualizar(id, dto, token);

    return { key };
  }

  @Post('org-banner/:id')
  @Roles(Role.REFERENTE)
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Upload banner image for an organization (referente owner only)' })
  @ApiConsumes('multipart/form-data')
  async uploadOrgBanner(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ key: string }> {
    if (!file) throw new BadRequestException('Image file is required (jpeg, png, or webp, max 5 MB)');

    const token = this.extractToken(req);
    await this.assertOwnership(id, token);

    const key = await this.uploadService.uploadOrgBanner(id, file);

    const dto = new ActualizarOrganizacionDto();
    dto.bannerKey = key;
    await this.organizacionesService.actualizar(id, dto, token);

    return { key };
  }

  private extractToken(req: Request): string {
    const token = (req as any).cookies?.['access_token'] as string | undefined;
    if (!token) throw new UnauthorizedException('No access token');
    return token;
  }

  private async assertOwnership(orgId: number, token: string): Promise<void> {
    const org = await this.organizacionesService.miOrganizacion(token);
    if (org.id !== orgId) throw new ForbiddenException('You do not own this organization');
  }
}
