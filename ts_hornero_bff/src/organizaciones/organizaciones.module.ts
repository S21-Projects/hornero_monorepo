import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OrganizacionesService } from './organizaciones.service.js';
import { OrganizacionesController } from './organizaciones.controller.js';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [OrganizacionesService],
  controllers: [OrganizacionesController],
})
export class OrganizacionesModule {}
