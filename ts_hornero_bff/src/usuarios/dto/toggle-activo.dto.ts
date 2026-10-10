import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleActivoDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  activo: boolean;
}
