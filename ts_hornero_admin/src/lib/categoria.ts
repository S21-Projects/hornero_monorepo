import type { CategoriaAlimento } from '../types/domain';

/** `CategoriaAlimento.nivelMinimo` ordinal mirror (MS `domain/CategoriaAlimento.java`). */
const NIVEL: Record<CategoriaAlimento, number> = {
  NO_PERECEDERO: 1,
  REFRIGERADO: 2,
  CONGELADO: 2,
};

/**
 * Mirrors MS `CategoriaAlimento.masExigente` (feature catalogo-articulos, decision 5): the most
 * demanding categoria among a donación's lines or a necesidad's selected articulos, ordered by
 * `nivelMinimo`. A tie between categorias sharing the same nivel (REFRIGERADO/CONGELADO, both N2)
 * resolves to whichever is encountered first. Returns `null` for an empty list instead of
 * throwing, since the UI needs to render "no selection yet" rather than crash.
 */
export function masExigente(categorias: CategoriaAlimento[]): CategoriaAlimento | null {
  if (categorias.length === 0) return null;
  return categorias.reduce((mas, actual) => (NIVEL[actual] > NIVEL[mas] ? actual : mas));
}
