import {
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

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

/** `categoria`: required for FONDO_COMUN, forbidden for DIRECTA. */
@ValidatorConstraint({ name: 'categoriaCrossField', async: false })
class CategoriaCrossFieldConstraint implements ValidatorConstraintInterface {
  private static readonly CATEGORIAS = [
    'NO_PERECEDERO',
    'REFRIGERADO',
    'CONGELADO',
  ];

  validate(value: unknown, args: ValidationArguments): boolean {
    if (resolveModalidad(args.object) === 'FONDO_COMUN') {
      return (
        typeof value === 'string' &&
        CategoriaCrossFieldConstraint.CATEGORIAS.includes(value)
      );
    }
    return value === undefined || value === null;
  }

  defaultMessage(args: ValidationArguments): string {
    return resolveModalidad(args.object) === 'FONDO_COMUN'
      ? 'categoria is required for FONDO_COMUN donations'
      : 'categoria is not allowed for DIRECTA donations';
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
 * `modalidad`, optional `necesidadId`, `categoria`, `latitud`, `longitud` with cross-field rules
 * matching `CreateDonacionRequest` (MS, slice 5b) — `FONDO_COMUN` requires `categoria` + coords and
 * forbids `necesidadId`; `DIRECTA` requires `necesidadId` and forbids `categoria`/coords.
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

  @Validate(CategoriaCrossFieldConstraint)
  categoria?: string;

  @Validate(CoordenadaCrossFieldConstraint)
  latitud?: number;

  @Validate(CoordenadaCrossFieldConstraint)
  longitud?: number;
}
