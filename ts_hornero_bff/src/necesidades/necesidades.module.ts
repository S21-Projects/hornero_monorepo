import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { NecesidadesService } from './necesidades.service.js';
import { NecesidadesController } from './necesidades.controller.js';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [NecesidadesService],
  controllers: [NecesidadesController],
})
export class NecesidadesModule {}
