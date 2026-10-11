import { IsDateString } from 'class-validator';

/** D2/N4: new expiry date for an expired necesidad (the MS requires it to be after today). */
export class RelanzarNecesidadDto {
  @IsDateString()
  fechaVencimiento!: string;
}
