import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { UploadService } from './upload.service.js';
import {
  PresignQueryDto,
  UploadTarget,
} from './dto/presign-query.dto.js';
import { OrganizacionesService } from '../organizaciones/organizaciones.service.js';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly organizacionesService: OrganizacionesService,
  ) {}

  @Get('presign')
  @ApiOperation({ summary: 'Generate a presigned S3 PUT URL for direct upload' })
  async presign(@Query() query: PresignQueryDto, @Req() req: Request) {
    const user = (req as any).user as { userId: number; tipo: string };
    if (!user?.userId) {
      throw new ForbiddenException('Unauthenticated');
    }

    let entityId: number;

    if (query.type === UploadTarget.USER_PHOTO) {
      // For user-photo, always use the authenticated user's id
      entityId = user.userId;
    } else {
      // For org targets, entityId must be provided and the user must be the referente
      if (!query.entityId) {
        throw new BadRequestException('entityId is required for org-profile and org-banner uploads');
      }
      entityId = query.entityId;

      // Ownership check: call MS to get the referente's org and verify it matches
      const token = (req as any).cookies?.['access_token'] as string | undefined;
      if (!token) throw new ForbiddenException('No access token');

      let myOrg: any;
      try {
        myOrg = await this.organizacionesService.miOrganizacion(token);
      } catch {
        throw new ForbiddenException('No se pudo verificar la organización');
      }

      if (!myOrg || myOrg.id !== entityId) {
        throw new ForbiddenException('No tenés permiso para subir imágenes de esta organización');
      }
    }

    return this.uploadService.presign(query.type, entityId, query.filename, query.contentType);
  }
}
