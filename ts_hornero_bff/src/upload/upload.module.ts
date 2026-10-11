import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthModule } from '../auth/auth.module.js';
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
    AuthModule,
  ],
  providers: [UploadService],
  controllers: [UploadController],
})
export class UploadModule {}
