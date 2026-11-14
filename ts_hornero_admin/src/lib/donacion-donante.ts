import { FaseDonacion, type Donacion, type EstadoDonacion } from '../types/domain';

/**
 * Donor-facing rules for a donación, shared by "Mis donaciones" and the detail screen so both
 * agree on what can be cancelled/confirmed, which estados are over, and what to tell the donor.
 */

// OFRECIDA -> CANCELADA (donante); ACEPTADA, EN_CAMINO -> CANCELADA (either party).
export const CANCELABLE_ESTADOS: ReadonlySet<string> = new Set(['OFRECIDA', 'ACEPTADA', 'EN_CAMINO']);

// A donante may generate/verify delivery codes while ACEPTADA, EN_CAMINO or
// PENDIENTE_CONFIRMACION, as long as they haven't already confirmed (spec `donacion-entrega-codigo`).
export const CONFIRMABLE_ESTADOS: ReadonlySet<string> = new Set([
  'ACEPTADA',
  'EN_CAMINO',
  'PENDIENTE_CONFIRMACION',
]);

/** Estados with no further transitions — these belong to the "Historial" tab. */
export const TERMINAL_ESTADOS: ReadonlySet<string> = new Set(['ENTREGADA', 'RECHAZADA', 'CANCELADA']);

type DonacionEstadoInfo = Pick<
  Donacion,
  'estado' | 'modalidad' | 'organizacionId' | 'organizacionNombre' | 'confirmadaDonanteEn' | 'fase'
>;

export const puedeCancelar = (d: Pick<Donacion, 'estado'>): boolean => CANCELABLE_ESTADOS.has(d.estado);

export const puedeConfirmar = (d: Pick<Donacion, 'estado' | 'confirmadaDonanteEn'>): boolean =>
  CONFIRMABLE_ESTADOS.has(d.estado) && !d.confirmadaDonanteEn;

export const esTerminal = (d: Pick<Donacion, 'estado'>): boolean => TERMINAL_ESTADOS.has(d.estado);

/**
 * `Donacion.fase` is optional on older responses; when absent, derive the closest phase from
 * `estado` so list rows can still draw their progress bar.
 */
export function faseDe(d: DonacionEstadoInfo): FaseDonacion {
  if (d.fase) return d.fase;
  const porEstado: Record<EstadoDonacion, FaseDonacion> = {
    OFRECIDA: FaseDonacion.OFRECIDA,
    ACEPTADA: FaseDonacion.ACEPTADA,
    EN_CAMINO: FaseDonacion.EN_CAMINO,
    PENDIENTE_CONFIRMACION: FaseDonacion.CONFIRMANDO,
    ENTREGADA: FaseDonacion.ENTREGADA,
    RECHAZADA: FaseDonacion.RECHAZADA,
    CANCELADA: FaseDonacion.CANCELADA,
  };
  if (d.estado === 'OFRECIDA' && d.modalidad === 'FONDO_COMUN' && !d.organizacionId) {
    return FaseDonacion.EN_FONDO;
  }
  return porEstado[d.estado] ?? FaseDonacion.OFRECIDA;
}

export interface ProximoPaso {
  titulo: string;
  texto: string;
}

/** What happens next / what the donor must do, one sentence per estado (voseo). */
export function proximoPaso(d: DonacionEstadoInfo): ProximoPaso {
  const fase = faseDe(d);
  if (fase === FaseDonacion.EN_FONDO) {
    return {
      titulo: 'Esperando asignación',
      texto: 'Esperando la próxima ronda de asignación. No tenés que hacer nada por ahora.',
    };
  }
  switch (d.estado) {
    case 'OFRECIDA':
      return d.organizacionId || d.organizacionNombre
        ? {
            titulo: 'Esperando respuesta',
            texto: 'La organización tiene que aceptar tu donación. Te avisamos apenas responda.',
          }
        : {
            titulo: 'Esperando respuesta',
            texto: 'Tu donación fue ofrecida. Estamos esperando que la organización responda.',
          };
    case 'ACEPTADA':
      return {
        titulo: 'Llevá tu donación',
        texto: 'El comedor aceptó. Llevá la donación y confirmá la entrega con el código.',
      };
    case 'EN_CAMINO':
      return {
        titulo: 'Confirmá la entrega',
        texto: 'Tu donación está en camino. Cuando llegue, confirmá la entrega con el código.',
      };
    case 'PENDIENTE_CONFIRMACION':
      return d.confirmadaDonanteEn
        ? {
            titulo: 'Esperando a la organización',
            texto: 'Ya confirmaste la entrega. Falta que la organización también la confirme.',
          }
        : {
            titulo: 'Confirmá la entrega',
            texto: 'La entrega está pendiente de confirmación. Confirmala con el código para cerrarla.',
          };
    case 'ENTREGADA':
      return { titulo: 'Donación entregada', texto: 'La donación llegó a destino. ¡Gracias por ayudar!' };
    case 'RECHAZADA':
      return {
        titulo: 'Donación rechazada',
        texto: 'La organización no pudo recibir esta donación. No hace falta que hagas nada más.',
      };
    case 'CANCELADA':
      return { titulo: 'Donación cancelada', texto: 'Cancelaste esta donación. Podés hacer una nueva cuando quieras.' };
    default:
      return { titulo: 'En curso', texto: 'Seguimos tu donación. Vas a ver acá cada novedad.' };
  }
}

/** "5 kg Arroz → Comedor Sol", or just the articles while there is no destination yet. */
export function titularDonacion(lineasTexto: string, organizacionNombre?: string | null): string {
  return organizacionNombre ? `${lineasTexto} → ${organizacionNombre}` : lineasTexto;
}
