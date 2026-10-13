import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RechazarReclamoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motivo: string;
}
