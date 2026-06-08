import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CrearOrganizacionDto {
  @ApiProperty({ example: 'Comedor La Esperanza' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'COMEDOR' })
  @IsString()
  @IsNotEmpty()
  tipo: string;

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
}
