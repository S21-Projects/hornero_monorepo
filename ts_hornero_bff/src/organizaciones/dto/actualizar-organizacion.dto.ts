import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TipoOrganizacion } from './crear-organizacion.dto.js';

export class ActualizarOrganizacionDto {
  @ApiPropertyOptional({ example: 'Comedor La Esperanza' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ example: 'COMEDOR', enum: Object.values(TipoOrganizacion) })
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
}
