import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ArticulosService } from './articulos.service.js';
import { ArticulosController } from './articulos.controller.js';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [ArticulosService],
  controllers: [ArticulosController],
  exports: [ArticulosService],
})
export class ArticulosModule {}
