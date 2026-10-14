import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { ImagesService } from './images.service.js';

/**
 * Object-key prefixes reserved for accreditation evidence and claim evidence (see
 * `specs/organizacion-acreditacion/spec.md`). The authenticated, ownership- and row-checked
 * `evidencia-files` route (AD-12) is the only supported way to read these files; this deny-list
 * stays as defense in depth so any key resolving under this prefix is still denied outright here
 * too (Threat Matrix "Evidence key smuggling" row).
 */
const EVIDENCIA_PREFIXES = ['org-evidencia/', 'reclamo-evidencia/'];

/**
 * Normalizes an S3 object key before the deny-list check: repeatedly URL-decodes it (catching
 * single and double encoding of path separators), strips leading slashes, and collapses `.` /
 * `..` segments — so a leading slash, an encoded `%2F`, a `../` traversal attempt, or mixed case
 * cannot smuggle a key that still resolves under a reserved prefix past a naive exact-string check.
 */
function isEvidenciaKey(rawKey: string): boolean {
  let key = rawKey;
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(key);
      if (decoded === key) break;
      key = decoded;
    } catch {
      break;
    }
  }

  key = key.replace(/^\/+/, '');

  const segments: string[] = [];
  for (const segment of key.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const normalized = segments.join('/').toLowerCase();
  return EVIDENCIA_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

@ApiTags('images')
@Public()
@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Get()
  @ApiOperation({ summary: 'Serve a stored S3 image by key (public)' })
  @ApiQuery({ name: 'key', description: 'S3 object key', required: true })
  async serveImage(
    @Query('key') key: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (isEvidenciaKey(key)) {
      throw new ForbiddenException(
        'Accreditation evidence is not readable through the public image route',
      );
    }

    const { body, contentType } = await this.imagesService.getObject(key);
    res.set('Content-Type', contentType ?? 'application/octet-stream');
    // Upload keys embed a random UUID and are never overwritten, so a cached copy can't go stale.
    // Lets browsers and the Cloudflare edge serve repeat views without hitting the Pi or R2.
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(body);
  }
}
