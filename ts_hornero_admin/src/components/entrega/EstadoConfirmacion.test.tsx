import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EstadoConfirmacion } from './EstadoConfirmacion';

/**
 * Spec `donacion-entrega-codigo` — "Screen reflects the counterpart's confirmation status": the
 * mockup's card "Estado de la confirmación" with "Tu confirmación" / the counterpart's role label
 * (Organización for a donante viewer, Donante for a referente viewer) as separate status pills.
 */
describe('EstadoConfirmacion', () => {
  it('labels the counterpart as "Organización" for a donante viewer', () => {
    render(
      <EstadoConfirmacion
        parteActual="DONANTE"
        confirmadaDonanteEn={null}
        confirmadaReferenteEn={null}
      />,
    );

    expect(screen.getByText(/tu confirmación/i)).toBeInTheDocument();
    expect(screen.getByText(/organización/i)).toBeInTheDocument();
  });

  it('labels the counterpart as "Donante" for a referente viewer', () => {
    render(
      <EstadoConfirmacion
        parteActual="REFERENTE"
        confirmadaDonanteEn={null}
        confirmadaReferenteEn={null}
      />,
    );

    expect(screen.getByText(/tu confirmación/i)).toBeInTheDocument();
    expect(screen.getByText(/donante/i)).toBeInTheDocument();
  });

  it('shows the own side as confirmed once its timestamp is set', () => {
    render(
      <EstadoConfirmacion
        parteActual="DONANTE"
        confirmadaDonanteEn="2026-09-30T12:00:00Z"
        confirmadaReferenteEn={null}
      />,
    );

    const pills = screen.getAllByText(/confirmad[oa]|pendiente/i);
    expect(pills[0]).toHaveTextContent(/confirmad/i);
    expect(pills[1]).toHaveTextContent(/pendiente/i);
  });

  it('shows the counterpart as confirmed once its timestamp is set', () => {
    render(
      <EstadoConfirmacion
        parteActual="DONANTE"
        confirmadaDonanteEn={null}
        confirmadaReferenteEn="2026-09-30T12:00:00Z"
      />,
    );

    const pills = screen.getAllByText(/confirmad[oa]|pendiente/i);
    expect(pills[0]).toHaveTextContent(/pendiente/i);
    expect(pills[1]).toHaveTextContent(/confirmad/i);
  });
});
