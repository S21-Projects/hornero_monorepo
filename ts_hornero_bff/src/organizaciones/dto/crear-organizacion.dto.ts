import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const TipoOrganizacion = {
  COMEDOR: 'COMEDOR',
  COPITA: 'COPITA',
  ROPERO: 'ROPERO',
  MERENDERO: 'MERENDERO',
  OTRO: 'OTRO',
} as const;
export type TipoOrganizacion =
  (typeof TipoOrganizacion)[keyof typeof TipoOrganizacion];

export class CrearOrganizacionDto {
  @ApiProperty({ example: 'Comedor La Esperanza' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'COMEDOR', enum: Object.values(TipoOrganizacion) })
  @IsEnum(TipoOrganizacion)
  @IsNotEmpty()
  tipo: TipoOrganizacion;

  @ApiPropertyOptional({ example: 'Comedor comunitario en el barrio norte' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ example: 'Av. Siempreviva 742' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({ example: -34.6037 })
  @IsNumber()
  latitud: number;

  @ApiProperty({ example: -58.3816 })
  @IsNumber()
  longitud: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  aceptaDonaciones?: boolean;

  // Mirrors the MS UrlSegura allowlist for fast feedback; the MS is the authority.
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
