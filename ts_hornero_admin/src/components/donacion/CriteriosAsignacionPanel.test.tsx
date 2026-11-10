import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CriteriosAsignacionPanel } from './CriteriosAsignacionPanel';

// Slice 5e / spec `donacion-fondo-comun` — "Nueva Donación Screen": the panel must explain the
// 5 scoring criteria (déficit, urgencia, proximidad, espera, cumplimiento) without exposing any
// organizacion-identifying data before assignment. The 5th criterion (cumplimiento) was added
// cosmetically in slice 6b (AD-11).
describe('CriteriosAsignacionPanel', () => {
  it('renders the 5 scoring criteria with short explanations', () => {
    render(<CriteriosAsignacionPanel />);

    expect(screen.getByText(/déficit de cobertura/i)).toBeInTheDocument();
    expect(screen.getByText(/urgencia/i)).toBeInTheDocument();
    expect(screen.getByText(/proximidad/i)).toBeInTheDocument();
    expect(screen.getByText(/tiempo de espera/i)).toBeInTheDocument();
    expect(screen.getByText(/cumplimiento hist[oó]rico/i)).toBeInTheDocument();
  });

  it('never renders organizacion-identifying data', () => {
    render(<CriteriosAsignacionPanel />);

    // Nothing in the static explainer should ever reference a specific org name/id —
    // the panel only explains the scoring mechanism in the abstract.
    expect(screen.queryByText(/organizaci[oó]n\s*#/i)).not.toBeInTheDocument();
  });
});
