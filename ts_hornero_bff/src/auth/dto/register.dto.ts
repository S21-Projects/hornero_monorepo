import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Ana Referente' })
  @IsString()
  nombre: string;

  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'secret123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({ enum: ['REFERENTE', 'DONANTE'], default: 'REFERENTE' })
  @IsOptional()
  @IsIn(['REFERENTE', 'DONANTE'])
  tipo?: string;
}
