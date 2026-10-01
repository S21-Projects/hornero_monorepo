import {
  ArrayNotEmpty,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

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

  // Feature catalogo-articulos, decision 6: null/absent means "leave articulos unchanged" (same
  // convention as every other field here); a provided list must be non-empty — a necesidad can
  // never be left with zero articulos. Mirrors `ActualizarNecesidadRequest` (MS).
  @IsOptional()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  articuloIds?: number[];
}
