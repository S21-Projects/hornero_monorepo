import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import MisDonacionesPage from './mis-donaciones';
import { useMisDonaciones } from '../lib/hooks/useMisDonaciones';
import { useCancelarDonacion } from '../lib/hooks/useCancelarDonacion';
import { makePage } from '../test/fixtures/page';
import type { Donacion } from '../types/domain';

/**
 * Task 3c.15/16 — the plain "Confirmar entrega" button is retired in favour of a link to the
 * code-verified confirmation screen (`/donaciones/:id/entrega`), spec `donacion-entrega-codigo`'s
 * "Retirement of the Unconditional Confirm Action".
 */
vi.mock('../lib/hooks/useMisDonaciones', () => ({ useMisDonaciones: vi.fn() }));
vi.mock('../lib/hooks/useCancelarDonacion', () => ({ useCancelarDonacion: vi.fn() }));

vi.mocked(useCancelarDonacion).mockReturnValue({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  variables: undefined,
} as unknown as ReturnType<typeof useCancelarDonacion>);

const donacionConfirmable: Donacion = {
  id: 1,
  estado: 'EN_CAMINO',
  necesidadId: 5,
  organizacionId: 7,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <MisDonacionesPage />
    </MemoryRouter>,
  );
}

// Task 5f.9: modalidad badge, a link to the detail screen, and a null organizacion rendered
// gracefully (FONDO_COMUN still waiting for a ronda).
describe('MisDonacionesPage — fondo común progress link', () => {
  it('shows the modalidad badge and a link to the detail screen', () => {
    vi.mocked(useMisDonaciones).mockReturnValue({
      data: makePage([{ ...donacionConfirmable, modalidad: 'FONDO_COMUN' }]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMisDonaciones>);

    renderPage();

    expect(screen.getByText(/fondo com[uú]n/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /ver detalle/i });
    expect(link).toHaveAttribute('href', '/mis-donaciones/1');
  });

  it('renders a null organizacion gracefully instead of crashing', () => {
    vi.mocked(useMisDonaciones).mockReturnValue({
      data: makePage([
        { ...donacionConfirmable, modalidad: 'FONDO_COMUN', organizacionId: null, estado: 'OFRECIDA' },
      ]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMisDonaciones>);

    expect(() => renderPage()).not.toThrow();
  });
});

describe('MisDonacionesPage — confirm-entrega retirement', () => {
  it('shows a "Confirmar entrega" link to the new screen, not the old plain button', () => {
    vi.mocked(useMisDonaciones).mockReturnValue({
      data: makePage([donacionConfirmable]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMisDonaciones>);

    renderPage();

    const link = screen.getByRole('link', { name: /confirmar entrega/i });
    expect(link).toHaveAttribute('href', '/donaciones/1/entrega');
  });

  it('shows the donación lines when present (feature catalogo-articulos)', () => {
    vi.mocked(useMisDonaciones).mockReturnValue({
      data: makePage([
        {
          ...donacionConfirmable,
          lineas: [
            { articuloId: 1, articuloNombre: 'Arroz', unidad: 'KG', cantidad: 5 },
            { articuloId: 2, articuloNombre: 'Fideos', unidad: 'PAQUETE', cantidad: 6 },
          ],
        },
      ]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMisDonaciones>);

    renderPage();

    expect(screen.getByText('5 kg Arroz, 6 paquetes Fideos')).toBeInTheDocument();
  });

  it('shows no confirm link once the donante already confirmed', () => {
    vi.mocked(useMisDonaciones).mockReturnValue({
      data: makePage([{ ...donacionConfirmable, confirmadaDonanteEn: '2026-09-30T10:00:00Z' }]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMisDonaciones>);

    renderPage();

    expect(screen.queryByRole('link', { name: /confirmar entrega/i })).not.toBeInTheDocument();
  });
});

describe('MisDonacionesPage — cancel requires confirmation', () => {
  it('opens a confirmation dialog first and only cancels once confirmed', async () => {
    const mutate = vi.fn();
    vi.mocked(useCancelarDonacion).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useCancelarDonacion>);
    vi.mocked(useMisDonaciones).mockReturnValue({
      data: makePage([{ ...donacionConfirmable, estado: 'OFRECIDA' }]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMisDonaciones>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Cancelar donación' }));

    expect(mutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: '¿Cancelar esta donación?' });

    await user.click(within(dialog).getByRole('button', { name: 'Sí, cancelar' }));

    expect(mutate).toHaveBeenCalledWith(1, expect.objectContaining({ onSettled: expect.any(Function) }));
  });

  it('keeps the donation when the dialog is dismissed with "Volver"', async () => {
    const mutate = vi.fn();
    vi.mocked(useCancelarDonacion).mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useCancelarDonacion>);
    vi.mocked(useMisDonaciones).mockReturnValue({
      data: makePage([{ ...donacionConfirmable, estado: 'OFRECIDA' }]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMisDonaciones>);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Cancelar donación' }));
    await user.click(screen.getByRole('button', { name: 'Volver' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });
});
