import { describe, it, expect } from 'vitest';
import {
  ESTADO_DONACION,
  ESTADO_NECESIDAD,
  PRIORIDAD,
  FALLBACK_BADGE,
} from './domain-ui';
// Importing the const objects (not enums — erasableSyntaxOnly is enabled).
import { EstadoDonacion, EstadoNecesidad, PrioridadNecesidad } from '../types/domain';

describe('ESTADO_DONACION', () => {
  it('every EstadoDonacion value returns a tone and label without throwing', () => {
    for (const val of Object.values(EstadoDonacion)) {
      const cfg = ESTADO_DONACION[val];
      expect(cfg).toBeDefined();
      expect(cfg.tone).toBeTruthy();
      expect(cfg.label).toBeTruthy();
    }
  });

  it('unknown value returns FALLBACK_BADGE (no crash)', () => {
    const cfg = ESTADO_DONACION['UNKNOWN_ESTADO'] ?? FALLBACK_BADGE;
    expect(cfg.tone).toBe('neutral');
  });
});

describe('ESTADO_NECESIDAD', () => {
  it('every EstadoNecesidad value returns a tone and label without throwing', () => {
    for (const val of Object.values(EstadoNecesidad)) {
      const cfg = ESTADO_NECESIDAD[val];
      expect(cfg).toBeDefined();
      expect(cfg.tone).toBeTruthy();
      expect(cfg.label).toBeTruthy();
    }
  });

  it('unknown value falls back to neutral (no crash)', () => {
    const cfg = ESTADO_NECESIDAD['CERRADA'] ?? FALLBACK_BADGE;
    expect(cfg.tone).toBe('neutral');
  });
});

describe('PRIORIDAD', () => {
  it('every PrioridadNecesidad value returns a tone and label without throwing', () => {
    for (const val of Object.values(PrioridadNecesidad)) {
      const cfg = PRIORIDAD[val];
      expect(cfg).toBeDefined();
      expect(cfg.tone).toBeTruthy();
      expect(cfg.label).toBeTruthy();
    }
  });

  it('URGENTE maps to danger tone', () => {
    expect(PRIORIDAD.URGENTE.tone).toBe('danger');
  });

  it('unknown value falls back to neutral (no crash)', () => {
    const cfg = PRIORIDAD['MUY_URGENTE'] ?? FALLBACK_BADGE;
    expect(cfg.tone).toBe('neutral');
  });
});
