import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerificarCodigoDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'codigo must be exactly 6 digits' })
  codigo: string;
}
