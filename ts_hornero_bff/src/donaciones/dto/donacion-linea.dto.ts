import 'reflect-metadata';
import { IsInt, IsPositive } from 'class-validator';

/**
 * One line of a `CrearDonacionDto` (feature catalogo-articulos, decision 4): an articulo id plus
 * a `cantidad > 0`. Mirrors `DonacionLineaRequest` (MS). Applies to both modalidades.
 */
export class DonacionLineaDto {
  @IsInt()
  articuloId: number;

  @IsPositive()
  cantidad: number;
}
