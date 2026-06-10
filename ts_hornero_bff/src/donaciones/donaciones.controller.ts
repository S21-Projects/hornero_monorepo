import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { DonacionesService } from './donaciones.service.js';

@ApiTags('donaciones')
@Controller('donaciones')
export class DonacionesController {
  constructor(private donacionesService: DonacionesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List donations, optionally filtered by organization (public)' })
  getDonaciones(@Query('organizacionId') organizacionId?: string) {
    return this.donacionesService.getDonaciones(organizacionId);
  }
}
