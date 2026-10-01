import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

/** Mirrors `CrearArticuloRequest` (MS, feature catalogo-articulos, work unit A). */
export class CrearArticuloDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(['NO_PERECEDERO', 'REFRIGERADO', 'CONGELADO'])
  categoria: string;

  @IsEnum(['KG', 'PAQUETE', 'LITRO', 'UNIDAD'])
  unidad: string;
}
