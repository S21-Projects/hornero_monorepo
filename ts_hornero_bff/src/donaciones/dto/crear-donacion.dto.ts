import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CrearDonacionDto {
  @IsNumber()
  necesidadId: number;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
