import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DonacionDetallePage from './donacion-detalle';
import { useDonacion } from '../lib/hooks/useDonacion';
import { useAsignaciones } from '../lib/hooks/useAsignaciones';
import type { Donacion, AsignacionHistorial } from '../types/domain';

// Task 5f.7 / design's `/mis-donaciones/:id` mockup: progress strip, modalidad badge, assigned
// organizacion, ronda date, score breakdown, assignment timeline; null organizacion renders as
// "Esperando ronda"; `?nueva=1` shows a success banner.
vi.mock('../lib/hooks/useDonacion', () => ({ useDonacion: vi.fn() }));
vi.mock('../lib/hooks/useAsignaciones', () => ({ useAsignaciones: vi.fn() }));

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

function mockDonacion(d: Partial<Donacion>) {
  vi.mocked(useDonacion).mockReturnValue({
    data: { id: 1, estado: 'ACEPTADA', necesidadId: 40, organizacionId: 8, ...d },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useDonacion>);
}

function mockAsignaciones(data: AsignacionHistorial[] | undefined, overrides: Partial<ReturnType<typeof useAsignaciones>> = {}) {
  vi.mocked(useAsignaciones).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    ...overrides,
  } as unknown as ReturnType<typeof useAsignaciones>);
}

function renderPage(path = '/mis-donaciones/1') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/mis-donaciones/:id" element={<DonacionDetallePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DonacionDetallePage', () => {
  it('shows the modalidad badge and the progress strip', () => {
    mockDonacion({ modalidad: 'FONDO_COMUN', fase: 'ASIGNADA', organizacionNombre: 'Comedor Sol' });
    mockAsignaciones([asignacion]);

    renderPage();

    expect(screen.getByText(/fondo com[uú]n/i)).toBeInTheDocument();
    expect(screen.getByText('Asignación')).toHaveAttribute('aria-current', 'step');
  });

  it('shows the assigned organizacion, ronda date, and score breakdown', () => {
    mockDonacion({ modalidad: 'FONDO_COMUN', fase: 'ASIGNADA', organizacionNombre: 'Comedor Sol' });
    mockAsignaciones([asignacion]);

    renderPage();

    expect(screen.getAllByText(/comedor sol/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/20\/09\/2026/).length).toBeGreaterThan(0);
    expect(screen.getByText(/puntaje total/i)).toBeInTheDocument();
  });

  it('shows "Esperando ronda" when there is no organizacion yet', () => {
    mockDonacion({ modalidad: 'FONDO_COMUN', fase: 'EN_FONDO', organizacionId: null, organizacionNombre: undefined });
    mockAsignaciones([]);

    renderPage();

    expect(screen.getByText(/esperando ronda/i)).toBeInTheDocument();
  });

  it('shows a success banner when ?nueva=1 is present', () => {
    mockDonacion({ modalidad: 'FONDO_COMUN', fase: 'EN_FONDO', organizacionId: null, organizacionNombre: undefined });
    mockAsignaciones([]);

    renderPage('/mis-donaciones/1?nueva=1');

    expect(screen.getByText(/donaci[oó]n registrada/i)).toBeInTheDocument();
  });

  it('does not show a success banner without the query param', () => {
    mockDonacion({ modalidad: 'FONDO_COMUN', fase: 'EN_FONDO', organizacionId: null, organizacionNombre: undefined });
    mockAsignaciones([]);

    renderPage();

    expect(screen.queryByText(/donaci[oó]n registrada/i)).not.toBeInTheDocument();
  });
});
