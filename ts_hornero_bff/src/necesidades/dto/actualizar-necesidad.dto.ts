import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class ActualizarNecesidadDto {
  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsEnum(['URGENTE', 'MEDIA', 'NORMAL'])
  prioridad?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
