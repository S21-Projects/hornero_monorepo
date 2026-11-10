import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

/**
 * Mirrors `ActualizarArticuloRequest` (MS): a full edit of nombre/categoria/unidad, not a
 * partial-update DTO — the MS requires all three fields (`@NotBlank`/`@NotNull`).
 */
export class ActualizarArticuloDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsEnum(['NO_PERECEDERO', 'REFRIGERADO', 'CONGELADO'])
  categoria: string;

  @IsEnum(['KG', 'PAQUETE', 'LITRO', 'UNIDAD'])
  unidad: string;
}
