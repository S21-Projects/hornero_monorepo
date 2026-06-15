import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service.js';
import { UploadController } from './upload.controller.js';
import { OrganizacionesModule } from '../organizaciones/organizaciones.module.js';

@Module({
  imports: [HttpModule, ConfigModule, OrganizacionesModule],
  providers: [UploadService],
  controllers: [UploadController],
  exports: [UploadService],
})
export class UploadModule {}
