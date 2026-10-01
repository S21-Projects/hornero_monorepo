import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesgloseScore } from './DesgloseScore';
import type { AsignacionHistorial } from '../../types/domain';

// Task 5f.2 / spec `ronda-asignacion` "Assignment persists full explainability data": renders
// each per-criterion contribution (term × weight) plus the total score and `deficitFuente`,
// accessibly (text values, not color-only — spec constraint carried from the design brief).
const asignacion: AsignacionHistorial = {
  id: 1,
  rondaId: 9,
  rondaFecha: '2026-09-20',
  necesidadId: 40,
  organizacionId: 8,
  organizacionNombre: 'Comedor Sol',
  estado: 'ACEPTADA',
  score: 0.71,
  costoOportunidad: 0,
  distanciaKm: 2.1,
  terminoDeficit: 0.33,
  terminoUrgencia: 0.6,
  terminoProximidad: 0.77,
  terminoEspera: 0.16,
  terminoCumplimiento: null,
  deficitFuente: 'NEUTRAL',
  codigoRadio: '',
  creadaEn: '2026-09-20T12:00:00Z',
  resueltaEn: null,
};

describe('DesgloseScore', () => {
  it('renders the total score', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    expect(screen.getByText(/puntaje total/i)).toBeInTheDocument();
    expect(screen.getByText('0.71')).toBeInTheDocument();
  });

  it('renders each of the four criteria with a text contribution value', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    expect(screen.getByText(/d[eé]ficit de cobertura/i)).toBeInTheDocument();
    expect(screen.getByText(/urgencia/i)).toBeInTheDocument();
    expect(screen.getByText(/proximidad/i)).toBeInTheDocument();
    expect(screen.getByText(/tiempo de espera/i)).toBeInTheDocument();

    // Every bar must surface a numeric text value (not color-only).
    const values = screen.getAllByTestId('desglose-valor');
    expect(values.length).toBe(4);
    values.forEach((v) => expect(v.textContent).toMatch(/\d/));
  });

  it('renders deficitFuente', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    expect(screen.getByText(/neutral/i)).toBeInTheDocument();
  });

  it('omits the 5th criterion when terminoCumplimiento is null', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    expect(screen.queryByText(/cumplimiento/i)).not.toBeInTheDocument();
  });

  it('renders the 5th criterion when terminoCumplimiento is present', () => {
    render(<DesgloseScore asignacion={{ ...asignacion, terminoCumplimiento: 0.85 }} />);

    expect(screen.getByText(/cumplimiento/i)).toBeInTheDocument();
  });
});
