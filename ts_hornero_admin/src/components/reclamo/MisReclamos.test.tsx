import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MisReclamos } from './MisReclamos';
import { useMisReclamos } from '../../lib/hooks/useReclamos';
import type { Reclamo } from '../../types/domain';

vi.mock('../../lib/hooks/useReclamos', () => ({ useMisReclamos: vi.fn() }));

const base: Reclamo = {
  id: 1, organizacionId: 4, organizacionNombre: 'Comedor X', organizacionSlug: 'comedor-x-1',
  solicitanteId: 7, solicitanteNombre: 'Ana', solicitanteEmail: 'a@t.com', rol: 'VOLUNTARIO',
  telefono: '351 555 1234', evidenciaKeys: [], estado: 'PENDIENTE', creadoEn: '2026-10-10T12:00:00Z',
};

function withReclamos(data: Reclamo[] | undefined) {
  vi.mocked(useMisReclamos).mockReturnValue({ data } as unknown as ReturnType<typeof useMisReclamos>);
}

describe('MisReclamos', () => {
  it('renders nothing when the referente never claimed a comedor', () => {
    withReclamos([]);
    const { container } = render(<MisReclamos />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the claims are loading', () => {
    withReclamos(undefined);
    const { container } = render(<MisReclamos />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows each claim with its status', () => {
    withReclamos([
      base,
      { ...base, id: 2, organizacionNombre: 'Comedor Y', estado: 'APROBADO' },
      { ...base, id: 3, organizacionNombre: 'Comedor Z', estado: 'RECHAZADO', motivoRechazo: 'Sin evidencia legible' },
    ]);
    render(<MisReclamos />);

    expect(screen.getByText('Mis reclamos')).toBeInTheDocument();
    expect(screen.getByText('En revisión')).toBeInTheDocument();
    expect(screen.getByText('Un administrador está revisando tu reclamo.')).toBeInTheDocument();
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
    expect(screen.getByText(/Tenés a cargo este comedor/)).toBeInTheDocument();
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    expect(screen.getByText('Motivo: Sin evidencia legible')).toBeInTheDocument();
  });
});
