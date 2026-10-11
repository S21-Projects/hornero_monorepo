import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Referente' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail()
  email: string;

  // Length bounds only (NIST SP 800-63B-4 3.1.1.2: 15..64, no composition rules). The MS is the
  // authority for the blocklist and the email/nombre-derived checks.
  @ApiProperty({
    example: 'la cafetera azul canta',
    minLength: 15,
    maxLength: 64,
  })
  @IsString()
  @MinLength(15, { message: 'PASSWORD_DEMASIADO_CORTA' })
  @MaxLength(64, { message: 'PASSWORD_DEMASIADO_LARGA' })
  password: string;

  @ApiPropertyOptional({ enum: ['REFERENTE', 'DONANTE'], default: 'REFERENTE' })
  @IsOptional()
  @IsIn(['REFERENTE', 'DONANTE'])
  tipo?: string;
}
