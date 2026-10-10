import { describe, it, expect } from 'vitest';
import { formatFechaHora, formatLineas } from './format';
import type { DonacionLinea } from '../types/domain';

// Work unit G (feature catalogo-articulos): a compact one-line summary of a donación's
// articulo lines, used by mis-donaciones/donacion-detalle/control-donaciones/dashboard.
describe('formatLineas', () => {
  it('returns — for an undefined or empty list', () => {
    expect(formatLineas(undefined)).toBe('—');
    expect(formatLineas([])).toBe('—');
  });

  it('formats a single línea with its unit', () => {
    const lineas: DonacionLinea[] = [
      { articuloId: 1, nombre: 'Arroz', unidad: 'KG', cantidad: 5 },
    ];
    expect(formatLineas(lineas)).toBe('5 kg Arroz');
  });

  it('pluralizes paquete/unidad units and joins multiple lines with a comma', () => {
    const lineas: DonacionLinea[] = [
      { articuloId: 1, nombre: 'Arroz', unidad: 'KG', cantidad: 5 },
      { articuloId: 2, nombre: 'Fideos', unidad: 'PAQUETE', cantidad: 6 },
    ];
    expect(formatLineas(lineas)).toBe('5 kg Arroz, 6 paquetes Fideos');
  });

  it('keeps a singular paquete when cantidad is 1', () => {
    const lineas: DonacionLinea[] = [
      { articuloId: 1, nombre: 'Fideos', unidad: 'PAQUETE', cantidad: 1 },
    ];
    expect(formatLineas(lineas)).toBe('1 paquete Fideos');
  });
});

describe('formatFechaHora', () => {
  it('renders an instant in Argentina time (UTC-3)', () => {
    expect(formatFechaHora('2026-10-10T15:30:00Z')).toBe('10/10/2026 12:30:00');
  });

  it('returns — for missing or invalid input', () => {
    expect(formatFechaHora(undefined)).toBe('—');
    expect(formatFechaHora('not a date')).toBe('—');
  });
});
