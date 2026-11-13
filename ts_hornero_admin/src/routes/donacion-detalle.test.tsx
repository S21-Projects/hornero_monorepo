import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DonacionDetallePage from './donacion-detalle';
import { useDonacion } from '../lib/hooks/useDonacion';
import { useAsignaciones } from '../lib/hooks/useAsignaciones';
import { useCancelarDonacion } from '../lib/hooks/useCancelarDonacion';
import type { Donacion, AsignacionHistorial } from '../types/domain';

// Task 5f.7 / design's `/mis-donaciones/:id` mockup: progress strip, modalidad badge, assigned
// organizacion, ronda date, score breakdown, assignment timeline; null organizacion renders as
// "Esperando ronda"; `?nueva=1` shows a success banner.
vi.mock('../lib/hooks/useDonacion', () => ({ useDonacion: vi.fn() }));
vi.mock('../lib/hooks/useAsignaciones', () => ({ useAsignaciones: vi.fn() }));
vi.mock('../lib/hooks/useCancelarDonacion', () => ({ useCancelarDonacion: vi.fn() }));

const mutate = vi.fn();
vi.mocked(useCancelarDonacion).mockReturnValue({
  mutate,
  isPending: false,
  isError: false,
  variables: undefined,
} as unknown as ReturnType<typeof useCancelarDonacion>);

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
    expect(screen.getByText(/¿por qué este destino\?/i)).toBeInTheDocument();
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

  it('tells DIRECTA donors the organización has to accept, not that a ronda is next', () => {
    mockDonacion({ modalidad: 'DIRECTA', fase: 'ASIGNADA', organizacionNombre: 'Comedor Sol' });
    mockAsignaciones([]);

    renderPage('/mis-donaciones/1?nueva=1');

    expect(screen.getByText(/la organización tiene que aceptarla/i)).toBeInTheDocument();
    expect(screen.queryByText(/próxima ronda/i)).not.toBeInTheDocument();
  });

  it('keeps the próxima ronda copy for FONDO_COMUN in the banner', () => {
    mockDonacion({ modalidad: 'FONDO_COMUN', fase: 'EN_FONDO', organizacionId: null, organizacionNombre: undefined });
    mockAsignaciones([]);

    renderPage('/mis-donaciones/1?nueva=1');

    expect(screen.getByText(/va a entrar a la próxima ronda/i)).toBeInTheDocument();
  });

  it('shows the donación lines when present (feature catalogo-articulos)', () => {
    mockDonacion({
      modalidad: 'FONDO_COMUN',
      fase: 'ASIGNADA',
      organizacionNombre: 'Comedor Sol',
      lineas: [
        { articuloId: 1, articuloNombre: 'Arroz', unidad: 'KG', cantidad: 5 },
        { articuloId: 2, articuloNombre: 'Fideos', unidad: 'PAQUETE', cantidad: 6 },
      ],
    });
    mockAsignaciones([asignacion]);

    renderPage();

    expect(screen.getByText('5 kg Arroz')).toBeInTheDocument();
    expect(screen.getByText('6 paquetes Fideos')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '5 kg Arroz, 6 paquetes Fideos para Comedor Sol' }),
    ).toBeInTheDocument();
  });

  it('does not show a success banner without the query param', () => {
    mockDonacion({ modalidad: 'FONDO_COMUN', fase: 'EN_FONDO', organizacionId: null, organizacionNombre: undefined });
    mockAsignaciones([]);

    renderPage();

    expect(screen.queryByText(/donaci[oó]n registrada/i)).not.toBeInTheDocument();
  });

  it('links back to Mis donaciones', () => {
    mockDonacion({ fase: 'ASIGNADA' });
    mockAsignaciones([asignacion]);

    renderPage();

    expect(screen.getByRole('link', { name: '← Mis donaciones' })).toHaveAttribute('href', '/mis-donaciones');
  });

  it('shows the next step with a single confirm action when the donación is confirmable', () => {
    mockDonacion({ estado: 'ACEPTADA', fase: 'ACEPTADA' });
    mockAsignaciones([asignacion]);

    renderPage();

    expect(screen.getByText('Próximo paso')).toBeInTheDocument();
    expect(screen.getByText(/llevá la donación y confirmá la entrega con el código/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Confirmar entrega' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Confirmar entrega' })).toHaveAttribute('href', '/donaciones/1/entrega');
  });

  it('shows no confirm action when waiting for a ronda', () => {
    mockDonacion({ estado: 'OFRECIDA', modalidad: 'FONDO_COMUN', fase: 'EN_FONDO', organizacionId: null });
    mockAsignaciones([]);

    renderPage();

    expect(screen.getByText(/no tenés que hacer nada por ahora/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Confirmar entrega' })).not.toBeInTheDocument();
  });

  it('cancels through a confirmation dialog', async () => {
    mockDonacion({ estado: 'OFRECIDA', fase: 'OFRECIDA' });
    mockAsignaciones([]);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Cancelar donación…' }));
    expect(mutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: '¿Cancelar esta donación?' });
    await user.click(within(dialog).getByRole('button', { name: 'Sí, cancelar' }));

    expect(mutate).toHaveBeenCalledWith(1, expect.objectContaining({ onSettled: expect.any(Function) }));
  });

  it('offers no cancel for a delivered donación', () => {
    mockDonacion({ estado: 'ENTREGADA', fase: 'ENTREGADA' });
    mockAsignaciones([asignacion]);

    renderPage();

    expect(screen.queryByRole('button', { name: /cancelar donación/i })).not.toBeInTheDocument();
  });

  it('lists the assignment history newest first as a timeline', () => {
    mockDonacion({ fase: 'ASIGNADA' });
    mockAsignaciones([
      { ...asignacion, id: 1, rondaFecha: '2026-09-10', organizacionNombre: 'Comedor Luna', estado: 'RECHAZADA' },
      { ...asignacion, id: 2, rondaFecha: '2026-09-20', organizacionNombre: 'Comedor Sol', estado: 'PROPUESTA' },
    ]);

    renderPage();

    const items = within(screen.getByRole('heading', { name: 'Historial de asignaciones' }).parentElement!).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Propuesta a Comedor Sol');
    expect(items[0]).toHaveTextContent('20/09/2026');
    expect(items[1]).toHaveTextContent('Comedor Luna rechazó la donación');
  });

  it('shows plain-language criteria in the aside and hides the numbers until expanded', () => {
    mockDonacion({ fase: 'ASIGNADA' });
    mockAsignaciones([asignacion]);

    renderPage();

    expect(screen.getByRole('img', { name: /necesidad de la zona/i })).toBeInTheDocument();
    expect(screen.getByText('Ver el cálculo')).toBeInTheDocument();
  });
});
