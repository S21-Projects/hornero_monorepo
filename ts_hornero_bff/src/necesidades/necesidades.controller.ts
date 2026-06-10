import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { NecesidadesService } from './necesidades.service.js';

@ApiTags('necesidades')
@Controller('necesidades')
export class NecesidadesController {
  constructor(private necesidadesService: NecesidadesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List needs, optionally filtered by organization (public)' })
  getNecesidades(@Query('organizacionId') organizacionId?: string) {
    return this.necesidadesService.getNecesidades(organizacionId);
  }
}
