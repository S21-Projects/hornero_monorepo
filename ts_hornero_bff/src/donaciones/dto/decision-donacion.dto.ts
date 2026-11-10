import { IsIn } from 'class-validator';

export class DecisionDonacionDto {
  @IsIn(['ACEPTADA', 'RECHAZADA'])
  estado: string;
}
