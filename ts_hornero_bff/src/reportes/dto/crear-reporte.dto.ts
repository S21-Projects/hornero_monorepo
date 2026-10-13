import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Mirrors `MotivoReporte` in the MS (`jar_hornero_ms/.../domain/MotivoReporte.java`). */
export const MOTIVOS_REPORTE = [
  'INACTIVO',
  'DATOS_INCORRECTOS',
  'DUPLICADO',
  'OTRO',
] as const;

/** Mirrors the MS's `CrearReporteRequest`; the MS re-validates everything (it is the authority). */
export class CrearReporteDto {
  @IsInt()
  @Min(1)
  organizacionId: number;

  @IsIn(MOTIVOS_REPORTE)
  motivo: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  organizacionDuplicadaId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  detalle?: string;
}
