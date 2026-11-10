import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Mirrors the MS's `AuditarEvidenciaRequest` — body for `PATCH .../evidencias/{evId}/observar`. */
export class AuditarEvidenciaDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacion?: string;
}
