import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgresoDonacion } from './ProgresoDonacion';
import { FaseDonacion } from '../../types/domain';

// Task 5f.1 / design AD-4: the progress strip has 4 visual steps (Ofrecida → Asignación → En
// camino → Entregada) and every `FaseDonacion` value maps onto exactly one of them —
// `EN_FONDO` and `ASIGNADA` are both FONDO_COMUN-only steps that must render distinctly.
describe('ProgresoDonacion', () => {
  it('shows "En espera de asignación" for EN_FONDO, not reaching the Asignación step', () => {
    render(<ProgresoDonacion fase={FaseDonacion.EN_FONDO} />);

    expect(screen.getByText(/en espera de asignaci[oó]n/i)).toBeInTheDocument();
    const asignacion = screen.getByText('Asignación');
    expect(asignacion.getAttribute('aria-current')).not.toBe('step');
  });

  it('marks Asignación as the current step once ASIGNADA', () => {
    render(<ProgresoDonacion fase={FaseDonacion.ASIGNADA} />);

    expect(screen.getByText('Asignación')).toHaveAttribute('aria-current', 'step');
  });

  it('marks Ofrecida as current for a DIRECTA donación still OFRECIDA', () => {
    render(<ProgresoDonacion fase={FaseDonacion.OFRECIDA} />);

    expect(screen.getByText('Ofrecida')).toHaveAttribute('aria-current', 'step');
  });

  it('marks Asignación as current for ACEPTADA (donante already matched to an org)', () => {
    render(<ProgresoDonacion fase={FaseDonacion.ACEPTADA} />);

    expect(screen.getByText('Asignación')).toHaveAttribute('aria-current', 'step');
  });

  it('marks En camino as current for EN_CAMINO and CONFIRMANDO', () => {
    const { rerender } = render(<ProgresoDonacion fase={FaseDonacion.EN_CAMINO} />);
    expect(screen.getByText('En camino')).toHaveAttribute('aria-current', 'step');

    rerender(<ProgresoDonacion fase={FaseDonacion.CONFIRMANDO} />);
    expect(screen.getByText('En camino')).toHaveAttribute('aria-current', 'step');
  });

  it('marks Entregada as current and complete for ENTREGADA', () => {
    render(<ProgresoDonacion fase={FaseDonacion.ENTREGADA} />);

    expect(screen.getByText('Entregada')).toHaveAttribute('aria-current', 'step');
  });

  it('renders a terminal banner for RECHAZADA/CANCELADA instead of a progress step', () => {
    render(<ProgresoDonacion fase={FaseDonacion.CANCELADA} />);

    expect(screen.getByText(/cancelada/i)).toBeInTheDocument();
    expect(screen.queryByText('Entregada')).not.toHaveAttribute('aria-current', 'step');
  });

  it('shows a date under a step only when real data is provided', () => {
    render(<ProgresoDonacion fase={FaseDonacion.ASIGNADA} fechas={{ ofrecida: '2026-09-18', asignacion: '2026-09-20' }} />);

    expect(screen.getByText('18/09/2026')).toBeInTheDocument();
    expect(screen.getByText('20/09/2026')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('renders no dates when none are provided', () => {
    render(<ProgresoDonacion fase={FaseDonacion.ASIGNADA} />);

    expect(screen.queryByText(/\d{2}\/\d{2}\/\d{4}/)).not.toBeInTheDocument();
  });
});
