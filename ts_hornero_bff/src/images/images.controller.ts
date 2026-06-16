import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { ImagesService } from './images.service.js';

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
    const { body, contentType } = await this.imagesService.getObject(key);
    res.set('Content-Type', contentType ?? 'application/octet-stream');
    return new StreamableFile(body);
  }
}
