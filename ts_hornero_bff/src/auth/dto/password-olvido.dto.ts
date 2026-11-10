import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class PasswordOlvidoDto {
  @ApiProperty({ example: 'ana@example.com' })
  @IsEmail()
  email: string;
}
