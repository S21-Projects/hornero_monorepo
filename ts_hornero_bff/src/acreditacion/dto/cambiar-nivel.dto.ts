import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Mirrors `NivelAcreditacion` in the MS (`jar_hornero_ms/.../domain/NivelAcreditacion.java`). */
export const NIVELES_ACREDITACION = ['N0', 'N1', 'N2', 'N3'] as const;

/** Mirrors the MS's `CambiarNivelRequest`. */
export class CambiarNivelDto {
  @IsIn(NIVELES_ACREDITACION)
  destino: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;
}
