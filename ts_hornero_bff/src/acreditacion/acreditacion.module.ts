import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AcreditacionService } from './acreditacion.service.js';
import { AcreditacionController } from './acreditacion.controller.js';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [AcreditacionService],
  controllers: [AcreditacionController],
  // AD-12 (tesis-core-features slice 2): EvidenciaFilesModule imports this module to reach
  // AcreditacionService.verificarArchivoEvidencia for the authenticated evidence-file route.
  exports: [AcreditacionService],
})
export class AcreditacionModule {}
