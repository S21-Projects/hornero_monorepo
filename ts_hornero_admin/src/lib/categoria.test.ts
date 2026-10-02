import { describe, it, expect } from 'vitest';
import { masExigente } from './categoria';

// Mirrors MS `CategoriaAlimento.masExigente` (feature catalogo-articulos, decision 5):
// NO_PERECEDERO is N1, REFRIGERADO/CONGELADO are both N2 — a tie resolves to whichever is
// encountered first, since both impose the same accreditation-level requirement.
describe('masExigente', () => {
  it('returns the only categoria when there is one', () => {
    expect(masExigente(['NO_PERECEDERO'])).toBe('NO_PERECEDERO');
  });

  it('picks REFRIGERADO/CONGELADO (N2) over NO_PERECEDERO (N1)', () => {
    expect(masExigente(['NO_PERECEDERO', 'REFRIGERADO'])).toBe('REFRIGERADO');
    expect(masExigente(['CONGELADO', 'NO_PERECEDERO'])).toBe('CONGELADO');
  });

  it('resolves a REFRIGERADO/CONGELADO tie to the first one encountered', () => {
    expect(masExigente(['REFRIGERADO', 'CONGELADO'])).toBe('REFRIGERADO');
    expect(masExigente(['CONGELADO', 'REFRIGERADO'])).toBe('CONGELADO');
  });

  it('returns null for an empty list', () => {
    expect(masExigente([])).toBeNull();
  });
});
