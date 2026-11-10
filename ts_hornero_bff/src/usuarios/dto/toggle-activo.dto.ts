import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToggleActivoDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  activo: boolean;

  /** Optional reason; stored in the activity log by the MS. */
  @ApiPropertyOptional({ example: 'Abuso reiterado' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
