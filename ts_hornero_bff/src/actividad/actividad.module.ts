import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ActividadService } from './actividad.service.js';
import { ActividadController } from './actividad.controller.js';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [ActividadService],
  controllers: [ActividadController],
})
export class ActividadModule {}
