import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PasswordRestablecerDto {
  @ApiProperty({ description: 'Single-use token from the reset email link' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  token: string;

  // Length bounds only (mirror of RegisterDto / NIST SP 800-63B-4 3.1.1.2). The MS is the
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
}
