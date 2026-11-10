import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoOrganizacion } from './crear-organizacion.dto.js';

export class ActualizarOrganizacionDto {
  @ApiPropertyOptional({ example: 'Comedor La Esperanza' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({
    example: 'COMEDOR',
    enum: Object.values(TipoOrganizacion),
  })
  @IsOptional()
  @IsEnum(TipoOrganizacion)
  tipo?: TipoOrganizacion;

  @ApiPropertyOptional({ example: 'Comedor comunitario en el barrio norte' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ example: 'Av. Siempreviva 742' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: -34.6037 })
  @IsOptional()
  @IsNumber()
  latitud?: number;

  @ApiPropertyOptional({ example: -58.3816 })
  @IsOptional()
  @IsNumber()
  longitud?: number;

  @ApiPropertyOptional({ example: 'org-profile/42/1718300000000.jpg' })
  @IsOptional()
  @IsString()
  profileImageKey?: string;

  @ApiPropertyOptional({ example: 'org-banner/42/1718300000000.jpg' })
  @IsOptional()
  @IsString()
  bannerKey?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  aceptaDonaciones?: boolean;

  // Referente writes route through the MS pending-approval snapshot.
  // '' is the explicit clear sentinel and must skip the @IsUrl check.
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
}
