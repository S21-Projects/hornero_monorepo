import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ImagesService } from '../images/images.service.js';
import { ReclamosController } from './reclamos.controller.js';
import { ReclamoFilesController } from './reclamo-files.controller.js';
import { ReclamosService } from './reclamos.service.js';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [ReclamosService, ImagesService],
  controllers: [ReclamosController, ReclamoFilesController],
  exports: [ReclamosService],
})
export class ReclamosModule {}
