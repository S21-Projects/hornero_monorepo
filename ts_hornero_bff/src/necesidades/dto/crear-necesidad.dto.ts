import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';

export class CrearNecesidadDto {
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsEnum(['URGENTE', 'MEDIA', 'NORMAL'])
  prioridad: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
