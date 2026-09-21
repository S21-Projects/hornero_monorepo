import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrganizacionesModule } from '../organizaciones/organizaciones.module.js';
import { EvidenciaFilesController } from './evidencia-files.controller.js';
import { ImagesService } from '../images/images.service.js';

@Module({
  imports: [ConfigModule, OrganizacionesModule],
  providers: [ImagesService],
  controllers: [EvidenciaFilesController],
})
export class EvidenciaFilesModule {}
