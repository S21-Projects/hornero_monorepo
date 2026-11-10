import {
  ArrayNotEmpty,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  IsInt,
} from 'class-validator';

export class CrearNecesidadDto {
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsEnum(['URGENTE', 'MEDIA', 'NORMAL'])
  prioridad: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsInt()
  organizacionId: number;

  // Feature catalogo-articulos, decision 6: categoria is derived from the selected articulos,
  // never hand-picked — at least one articulo is required. Mirrors `CrearNecesidadRequest` (MS).
  @ArrayNotEmpty()
  @IsInt({ each: true })
  articuloIds: number[];
}
