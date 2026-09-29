import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AcreditacionModule } from '../acreditacion/acreditacion.module.js';
import { EvidenciaFilesController } from './evidencia-files.controller.js';
import { ImagesService } from '../images/images.service.js';

// AD-12 (tesis-core-features slice 2): imports AcreditacionModule instead of
// OrganizacionesModule — the MS's row-bound check is now the sole authority.
@Module({
  imports: [ConfigModule, AcreditacionModule],
  providers: [ImagesService],
  controllers: [EvidenciaFilesController],
})
export class EvidenciaFilesModule {}
