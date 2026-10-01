import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BienvenidaAcreditacion } from './BienvenidaAcreditacion';
import { useAcreditacion, useLegajo } from '../../lib/hooks/useAcreditacion';
import type { RequisitoEnLegajo } from '../../types/domain';

vi.mock('../../lib/hooks/useAcreditacion', () => ({
  useAcreditacion: vi.fn(),
  useLegajo: vi.fn(),
}));

function mockNivel(nivel: 'N0' | 'N1' | 'N2' | 'N3') {
  vi.mocked(useAcreditacion).mockReturnValue({
    data: { organizacionId: 1, nivel, nivelDesde: '2026-01-01T00:00:00Z' },
    isLoading: false,
    isSuccess: true,
    isError: false,
  } as unknown as ReturnType<typeof useAcreditacion>);
}

function mockLegajo(requisitos: RequisitoEnLegajo[] | undefined, overrides = {}) {
  vi.mocked(useLegajo).mockReturnValue({
    data: requisitos ? { requisitos } : undefined,
    isLoading: false,
    isSuccess: requisitos != null,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useLegajo>);
}

function requisito(nivelExigido: 'N1' | 'N2' | 'N3', estado: 'APROBADA' | 'PENDIENTE' | 'OBSERVADA' | 'FALTANTE'): RequisitoEnLegajo {
  return { requisito: 'SERVICIO_REGULAR_GRATUITO', nivelExigido, estado, expirada: false };
}

describe('BienvenidaAcreditacion', () => {
  it('renders the N0..N3 ladder copy and the organización name in the heading', () => {
    mockNivel('N0');
    mockLegajo([]);
    render(
      <BienvenidaAcreditacion
        organizacionId={1}
        organizacionNombre="Comedor Los Hornitos"
        onEmpezar={vi.fn()}
        onMasTarde={vi.fn()}
      />,
    );

    expect(screen.getByText('Comedor Los Hornitos ya está registrado(a)')).toBeInTheDocument();
    expect(screen.getByText(/registro de la organización y su referente/)).toBeInTheDocument();
    expect(screen.getByText(/servicio regular y gratuito, sin discriminación/)).toBeInTheDocument();
    expect(screen.getByText(/hasta 50 km del Banco de Alimentos/)).toBeInTheDocument();
    expect(screen.getByText(/acepta auditorías sin aviso/)).toBeInTheDocument();
  });

  it('marks the organización\'s current level (from useAcreditacion) as "Nivel actual", not another rung', () => {
    mockNivel('N2');
    mockLegajo([]);
    render(
      <BienvenidaAcreditacion
        organizacionId={7}
        organizacionNombre="Merendero San José"
        onEmpezar={vi.fn()}
        onMasTarde={vi.fn()}
      />,
    );

    const currentBadges = screen.getAllByText('Nivel actual');
    expect(currentBadges).toHaveLength(1);
    // The badge sits inside the N2 · Operativa card, not N0's.
    expect(currentBadges[0].closest('article, div')?.textContent).toContain('Operativa');
  });

  it('fires the onEmpezar navigation callback when "Empezar con N1" is clicked', async () => {
    mockNivel('N0');
    mockLegajo([]);
    const onEmpezar = vi.fn();
    const user = userEvent.setup();

    render(
      <BienvenidaAcreditacion
        organizacionId={1}
        organizacionNombre="Comedor Los Hornitos"
        onEmpezar={onEmpezar}
        onMasTarde={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Empezar con N1' }));
    expect(onEmpezar).toHaveBeenCalledTimes(1);
  });

  it('fires the onMasTarde callback when "Más tarde" is clicked, without calling onEmpezar', async () => {
    mockNivel('N0');
    mockLegajo([]);
    const onEmpezar = vi.fn();
    const onMasTarde = vi.fn();
    const user = userEvent.setup();

    render(
      <BienvenidaAcreditacion
        organizacionId={1}
        organizacionNombre="Comedor Los Hornitos"
        onEmpezar={onEmpezar}
        onMasTarde={onMasTarde}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Más tarde' }));
    expect(onMasTarde).toHaveBeenCalledTimes(1);
    expect(onEmpezar).not.toHaveBeenCalled();
  });

  // T7 — "Para llegar a N{next} te faltan N requisitos" computed from the legajo.
  describe('requisitos faltantes counter (T7)', () => {
    it('counts only the next level\'s requisitos that are not APROBADA', () => {
      mockNivel('N0');
      mockLegajo([
        requisito('N1', 'APROBADA'),
        requisito('N1', 'PENDIENTE'),
        requisito('N1', 'FALTANTE'),
        requisito('N2', 'FALTANTE'), // a later level's requisito must not be counted yet
      ]);

      render(
        <BienvenidaAcreditacion
          organizacionId={1}
          organizacionNombre="Comedor Los Hornitos"
          onEmpezar={vi.fn()}
          onMasTarde={vi.fn()}
        />,
      );

      expect(screen.getByText('Para llegar a N1 te faltan 2 requisitos')).toBeInTheDocument();
    });

    it('uses singular copy when exactly one requisito is missing', () => {
      mockNivel('N1');
      mockLegajo([requisito('N2', 'OBSERVADA')]);

      render(
        <BienvenidaAcreditacion
          organizacionId={1}
          organizacionNombre="Comedor Los Hornitos"
          onEmpezar={vi.fn()}
          onMasTarde={vi.fn()}
        />,
      );

      expect(screen.getByText('Para llegar a N2 te falta 1 requisito')).toBeInTheDocument();
    });

    it('shows no counter for N3 (no next level)', () => {
      mockNivel('N3');
      mockLegajo([]);

      render(
        <BienvenidaAcreditacion
          organizacionId={1}
          organizacionNombre="Comedor Los Hornitos"
          onEmpezar={vi.fn()}
          onMasTarde={vi.fn()}
        />,
      );

      expect(screen.queryByText(/te falta/)).not.toBeInTheDocument();
    });

    it('shows no counter while the legajo is still loading', () => {
      mockNivel('N0');
      mockLegajo(undefined, { isLoading: true });

      render(
        <BienvenidaAcreditacion
          organizacionId={1}
          organizacionNombre="Comedor Los Hornitos"
          onEmpezar={vi.fn()}
          onMasTarde={vi.fn()}
        />,
      );

      expect(screen.queryByText(/te falta/)).not.toBeInTheDocument();
    });

    it('shows no counter when the legajo fails to load', () => {
      mockNivel('N0');
      mockLegajo(undefined, { isError: true });

      render(
        <BienvenidaAcreditacion
          organizacionId={1}
          organizacionNombre="Comedor Los Hornitos"
          onEmpezar={vi.fn()}
          onMasTarde={vi.fn()}
        />,
      );

      expect(screen.queryByText(/te falta/)).not.toBeInTheDocument();
    });
  });
});
