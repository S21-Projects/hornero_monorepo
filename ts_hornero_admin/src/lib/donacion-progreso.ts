import { FaseDonacion, type FaseDonacion as FaseDonacionType } from '../types/domain';

/** The 4 visual steps shared by the detail strip and the compact list-row bar. */
export const PASOS_DONACION = ['Ofrecida', 'Asignación', 'En camino', 'Entregada'] as const;

/**
 * Maps every `FaseDonacion` value (design AD-4) onto its visual step index in the shared 4-step
 * strip (Ofrecida → Asignación → En camino → Entregada). `EN_FONDO` has no current step yet — the
 * donación is still waiting in the pool for a ronda.
 */
export function pasoActual(fase: FaseDonacionType): number | null {
  switch (fase) {
    case FaseDonacion.OFRECIDA:
      return 0;
    case FaseDonacion.ASIGNADA:
    case FaseDonacion.ACEPTADA:
      return 1;
    case FaseDonacion.EN_CAMINO:
    case FaseDonacion.CONFIRMANDO:
      return 2;
    case FaseDonacion.ENTREGADA:
      return 3;
    default:
      // EN_FONDO (waiting for a ronda) and RECHAZADA/CANCELADA (terminal) have no current step.
      return null;
  }
}
