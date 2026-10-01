import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DonacionLineaDto } from './donacion-linea.dto.js';

/**
 * Mirrors `CreateDonacionRequest`'s modalidad-dependent cross-field rule in the MS
 * (`jar_hornero_ms/.../donacion/DonacionService.crear`, slice 5b): a `null`/absent modalidad is
 * read as `DIRECTA`, matching `CreateDonacionRequest`'s own coalescing javadoc.
 */
function resolveModalidad(object: unknown): 'DIRECTA' | 'FONDO_COMUN' {
  return (object as { modalidad?: string } | null)?.modalidad === 'FONDO_COMUN'
    ? 'FONDO_COMUN'
    : 'DIRECTA';
}

/** `necesidadId`: required for DIRECTA, forbidden for FONDO_COMUN (`specs/donacion-fondo-comun`). */
@ValidatorConstraint({ name: 'necesidadIdCrossField', async: false })
class NecesidadIdCrossFieldConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (resolveModalidad(args.object) === 'DIRECTA') {
      return typeof value === 'number' && !Number.isNaN(value);
    }
    return value === undefined || value === null;
  }

  defaultMessage(args: ValidationArguments): string {
    return resolveModalidad(args.object) === 'DIRECTA'
      ? 'necesidadId is required for DIRECTA donations'
      : 'necesidadId is not allowed for FONDO_COMUN donations';
  }
}

/** `latitud`/`longitud`: required for FONDO_COMUN, forbidden for DIRECTA. */
@ValidatorConstraint({ name: 'coordenadaCrossField', async: false })
class CoordenadaCrossFieldConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (resolveModalidad(args.object) === 'FONDO_COMUN') {
      return typeof value === 'number' && !Number.isNaN(value);
    }
    return value === undefined || value === null;
  }

  defaultMessage(args: ValidationArguments): string {
    return resolveModalidad(args.object) === 'FONDO_COMUN'
      ? `${args.property} is required for FONDO_COMUN donations`
      : `${args.property} is not allowed for DIRECTA donations`;
  }
}

/**
 * `modalidad`, optional `necesidadId`, `lineas`, `latitud`, `longitud` with cross-field rules
 * matching `CreateDonacionRequest` (MS) — `FONDO_COMUN` requires coords and forbids `necesidadId`;
 * `DIRECTA` requires `necesidadId` and forbids coords. `lineas` is required for both modalidades
 * (feature catalogo-articulos, decision 4): `categoria` is no longer a client-supplied field, it
 * is always derived from `lineas` by the MS.
 */
export class CrearDonacionDto {
  @IsOptional()
  @IsIn(['DIRECTA', 'FONDO_COMUN'])
  modalidad?: string;

  @Validate(NecesidadIdCrossFieldConstraint)
  necesidadId?: number;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DonacionLineaDto)
  lineas: DonacionLineaDto[];

  @Validate(CoordenadaCrossFieldConstraint)
  latitud?: number;

  @Validate(CoordenadaCrossFieldConstraint)
  longitud?: number;
}
