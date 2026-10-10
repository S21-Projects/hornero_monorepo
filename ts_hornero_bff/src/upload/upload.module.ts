import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OrganizacionesModule } from '../organizaciones/organizaciones.module.js';
import { UploadController } from './upload.controller.js';
import { UploadService } from './upload.service.js';
import { imageMimeFilter } from './image-type.js';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: imageMimeFilter,
    }),
    OrganizacionesModule,
  ],
  providers: [UploadService],
  controllers: [UploadController],
})
export class UploadModule {}
