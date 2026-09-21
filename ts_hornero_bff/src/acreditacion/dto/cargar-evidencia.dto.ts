import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Mirrors `RequisitoAcreditacion` in the MS (`jar_hornero_ms/.../domain/RequisitoAcreditacion.java`). */
export const REQUISITOS_ACREDITACION = [
  'SERVICIO_REGULAR_GRATUITO',
  'NO_DISCRIMINACION',
  'SEDE_INSCRIPTA_INDIVIDUALMENTE',
  'CONDICIONES_SANITARIAS_ADECUADAS',
  'SIN_KIOSCO_MISMO_DOMICILIO',
  'RADIO_50KM_BANCO_ALIMENTOS',
  'PERSONERIA_JURIDICA_O_AVAL',
  'ACEPTA_AUDITORIAS_SIN_AVISO',
] as const;

/** Mirrors `TipoEvidencia` in the MS. */
export const TIPOS_EVIDENCIA = ['DECLARACION', 'FOTO', 'DOCUMENTO'] as const;

/**
 * Mirrors the MS's `CargarEvidenciaRequest` (`jar_hornero_ms/.../acreditacion/dto/`).
 * `objectKey` is accepted as a field — Slice B needs it — but the MS rejects it with `400` if
 * non-null in Slice A (there is no authenticated route yet to serve a file at that key).
 */
export class CargarEvidenciaDto {
  @IsIn(REQUISITOS_ACREDITACION)
  requisito: string;

  @IsIn(TIPOS_EVIDENCIA)
  tipoEvidencia: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  declaracion?: string;

  @IsOptional()
  @IsString()
  objectKey?: string;

  @IsOptional()
  @IsDateString()
  validoDesde?: string;

  @IsOptional()
  @IsDateString()
  validoHasta?: string;
}
