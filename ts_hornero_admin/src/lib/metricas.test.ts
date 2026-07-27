import { describe, it, expect } from 'vitest';
import { countByField, necesidadesPorEstado, usuariosPorRol, donacionesPorEstado } from './metricas';

describe('countByField', () => {
  it('zero-fills every known label even when no items match', () => {
    const result = countByField([], 'estado', { A: 'Alpha', B: 'Beta' });

    expect(result).toEqual([
      { key: 'A', label: 'Alpha', value: 0 },
      { key: 'B', label: 'Beta', value: 0 },
    ]);
  });

  it('counts occurrences per known label', () => {
    const items = [{ estado: 'A' }, { estado: 'A' }, { estado: 'B' }];

    const result = countByField(items, 'estado', { A: 'Alpha', B: 'Beta' });

    expect(result).toEqual([
      { key: 'A', label: 'Alpha', value: 2 },
      { key: 'B', label: 'Beta', value: 1 },
    ]);
  });

  it('falls back to the raw key as label when the value is not in the known labels map', () => {
    const items = [{ estado: 'UNKNOWN' }];

    const result = countByField(items, 'estado', { A: 'Alpha' });

    expect(result).toEqual([
      { key: 'A', label: 'Alpha', value: 0 },
      { key: 'UNKNOWN', label: 'UNKNOWN', value: 1 },
    ]);
  });

  it('coerces boolean field values to string keys', () => {
    const items = [{ activo: true }, { activo: false }, { activo: true }];

    const result = countByField(items, 'activo', { true: 'Activos', false: 'Inactivos' });

    expect(result).toEqual([
      { key: 'true', label: 'Activos', value: 2 },
      { key: 'false', label: 'Inactivos', value: 1 },
    ]);
  });
});

describe('necesidadesPorEstado', () => {
  it('maps necesidad estados to Spanish labels with zero-fill', () => {
    const result = necesidadesPorEstado([{ estado: 'ABIERTA' }, { estado: 'CUMPLIDA' }]);

    expect(result).toEqual(
      expect.arrayContaining([
        { key: 'ABIERTA', label: 'Abierta', value: 1 },
        { key: 'EN_PROGRESO', label: 'En progreso', value: 0 },
        { key: 'CUMPLIDA', label: 'Cumplida', value: 1 },
        { key: 'VENCIDA', label: 'Vencida', value: 0 },
      ]),
    );
  });
});

describe('usuariosPorRol', () => {
  it('maps user roles to Spanish labels with zero-fill', () => {
    const result = usuariosPorRol([
      { tipo: 'ADMINISTRADOR' },
      { tipo: 'REFERENTE' },
      { tipo: 'REFERENTE' },
    ]);

    expect(result).toEqual([
      { key: 'ADMINISTRADOR', label: 'Administrador', value: 1 },
      { key: 'REFERENTE', label: 'Referente', value: 2 },
      { key: 'DONANTE', label: 'Donante', value: 0 },
    ]);
  });

  it('returns all-zero counts for an empty user list', () => {
    const result = usuariosPorRol([]);

    expect(result.every((item) => item.value === 0)).toBe(true);
    expect(result).toHaveLength(3);
  });
});

describe('donacionesPorEstado', () => {
  it('maps donacion estados to Spanish labels with zero-fill', () => {
    const result = donacionesPorEstado([{ estado: 'OFRECIDA' }, { estado: 'ENTREGADA' }]);

    expect(result).toEqual([
      { key: 'OFRECIDA', label: 'Ofrecida', value: 1 },
      { key: 'EN_CAMINO', label: 'En camino', value: 0 },
      { key: 'ENTREGADA', label: 'Entregada', value: 1 },
      { key: 'CANCELADA', label: 'Cancelada', value: 0 },
    ]);
  });
});
