import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DescartarReporteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  nota: string;
}
