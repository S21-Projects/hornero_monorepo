import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateEstadoDonacionDto {
  @IsString()
  @IsNotEmpty()
  estado: string;
}
