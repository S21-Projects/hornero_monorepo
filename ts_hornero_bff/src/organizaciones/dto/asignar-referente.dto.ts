import { IsInt, ValidateIf } from 'class-validator';

export class AsignarReferenteDto {
  @ValidateIf((o) => o.referenteId !== null)
  @IsInt()
  referenteId: number | null;
}
