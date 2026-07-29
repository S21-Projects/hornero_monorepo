import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * Admin-only body for PATCH /organizaciones/:id/info-publica. Writes the
 * live columns directly at the MS, no pending-approval snapshot involved.
 */
export class ActualizarInfoPublicaDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  aceptaDonaciones?: boolean;

  @ApiPropertyOptional({ example: 'https://miorganizacion.org' })
  @IsOptional()
  @MaxLength(500)
  @ValidateIf((_o, v) => v !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  sitioWebUrl?: string;

  @ApiPropertyOptional({ example: 'https://mpago.la/miorganizacion' })
  @IsOptional()
  @MaxLength(500)
  @ValidateIf((_o, v) => v !== '')
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  donacionDirectaUrl?: string;

  /** S3 object key, set internally by UploadController after an admin-moderated image upload. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  profileImageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bannerKey?: string;
}
