import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class OverrideEstadoDto {
  @IsString()
  @IsNotEmpty()
  estado: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motivo: string;
}
