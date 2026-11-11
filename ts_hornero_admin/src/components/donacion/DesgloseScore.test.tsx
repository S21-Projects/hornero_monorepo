import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesgloseScore } from './DesgloseScore';
import { nivelCriterio } from '../../lib/score-nivel';
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

describe('nivelCriterio', () => {
  it('maps a 0..1 term onto Baja / Media / Alta thresholds', () => {
    expect(nivelCriterio(0.1)).toBe('Baja');
    expect(nivelCriterio(0.34)).toBe('Media');
    expect(nivelCriterio(0.66)).toBe('Media');
    expect(nivelCriterio(0.67)).toBe('Alta');
  });
});

describe('DesgloseScore', () => {
  it('labels each criterion in donor words with a qualitative level', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    expect(screen.getByRole('img', { name: 'Necesidad de la zona: Baja' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Urgencia del pedido: Media' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Cercanía: Alta' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Tiempo sin recibir: Baja' })).toBeInTheDocument();
    expect(screen.queryByText(/d[eé]ficit de cobertura/i)).not.toBeInTheDocument();
  });

  it('names the criteria that weighed most in an intro sentence', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    // contributions: deficit .12, urgencia .18, proximidad .15, espera .02
    expect(screen.getByText(/se eligió sobre todo por urgencia del pedido y cercanía/i)).toBeInTheDocument();
  });

  it('explains a NEUTRAL deficit source in plain language instead of the raw code', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    expect(screen.getByText(/sin datos censales para esta zona: la necesidad se tomó como promedio/i)).toBeInTheDocument();
    expect(screen.queryByText(/fuente del déficit/i)).not.toBeInTheDocument();
  });

  it('omits the note for an unknown deficit source', () => {
    render(<DesgloseScore asignacion={{ ...asignacion, deficitFuente: 'OTRA' }} />);

    expect(screen.queryByText(/sin datos censales/i)).not.toBeInTheDocument();
  });

  it('keeps the numeric calculation inside a collapsed "Ver el cálculo" section', async () => {
    const { container } = render(<DesgloseScore asignacion={asignacion} />);
    const details = container.querySelector('details') as HTMLDetailsElement;
    const user = userEvent.setup();

    expect(details.open).toBe(false);
    await user.click(screen.getByText('Ver el cálculo'));
    expect(details.open).toBe(true);

    expect(screen.getByText(/puntaje total/i)).toBeInTheDocument();
    expect(screen.getByText('0,71')).toBeInTheDocument();
    const values = screen.getAllByTestId('desglose-valor');
    expect(values.length).toBe(4);
    values.forEach((v) => expect(v.textContent).toMatch(/\d/));
  });

  it('omits the 5th criterion when terminoCumplimiento is null', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    expect(screen.queryByText(/cumplimiento/i)).not.toBeInTheDocument();
  });

  it('renders the 5th criterion when terminoCumplimiento is present', () => {
    render(<DesgloseScore asignacion={{ ...asignacion, terminoCumplimiento: 0.85 }} />);

    expect(screen.getByRole('img', { name: 'Cumplimiento: Alta' })).toBeInTheDocument();
  });

  // Task 5f.15: once a ronda snapshot carries its applied weights, the breakdown must use them
  // instead of the pre-6a hardcoded defaults, so "term × weight" stops drifting from 6a onward.
  it('uses the ronda-applied weight when present, instead of the hardcoded default', () => {
    render(
      <DesgloseScore
        asignacion={{ ...asignacion, pesoDeficit: 0.5, pesoUrgencia: 0.2, pesoProximidad: 0.2, pesoEspera: 0.1 }}
      />,
    );

    // deficit: 0.33 × 0.5 = 0.17 (default would have been 0.33 × 0.35 = 0.12)
    expect(screen.getByText(/0,33 × 0,50 = 0,17/)).toBeInTheDocument();
  });

  it('falls back to the hardcoded default weights when the ronda snapshot has none (older rows)', () => {
    render(<DesgloseScore asignacion={asignacion} />);

    // deficit: 0.33 × 0.35 = 0.12 (pre-AD-9 default, unchanged behaviour)
    expect(screen.getByText(/0,33 × 0,35 = 0,12/)).toBeInTheDocument();
  });

  it('uses the ronda-applied cumplimiento weight when both it and the term are present', () => {
    render(
      <DesgloseScore
        asignacion={{ ...asignacion, terminoCumplimiento: 0.8, pesoCumplimiento: 0.2 }}
      />,
    );

    expect(screen.getByText(/0,80 × 0,20 = 0,16/)).toBeInTheDocument();
  });
});
