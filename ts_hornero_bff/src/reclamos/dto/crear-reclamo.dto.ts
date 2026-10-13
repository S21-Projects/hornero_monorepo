import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/** Mirrors `RolReclamo` in the MS (`jar_hornero_ms/.../domain/RolReclamo.java`). */
export const ROLES_RECLAMO = [
  'RESPONSABLE',
  'VOLUNTARIO',
  'INTEGRANTE',
] as const;

/** Mirrors the MS's `CrearReclamoRequest`; the MS re-validates everything (it is the authority). */
export class CrearReclamoDto {
  @IsInt()
  @Min(1)
  organizacionId: number;

  @IsIn(ROLES_RECLAMO)
  rol: string;

  @IsString()
  @Matches(/^[0-9+()\-\s]{6,40}$/, { message: 'Teléfono inválido' })
  telefono: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mensaje?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  evidenciaKeys: string[];
}
