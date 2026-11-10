import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { RondasService } from './rondas.service.js';
import { RondasController } from './rondas.controller.js';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [RondasService],
  controllers: [RondasController],
})
export class RondasModule {}
