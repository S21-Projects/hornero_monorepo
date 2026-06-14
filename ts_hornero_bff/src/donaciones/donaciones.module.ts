import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { DonacionesService } from './donaciones.service.js';
import { DonacionesController } from './donaciones.controller.js';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [DonacionesService],
  controllers: [DonacionesController],
})
export class DonacionesModule {}
