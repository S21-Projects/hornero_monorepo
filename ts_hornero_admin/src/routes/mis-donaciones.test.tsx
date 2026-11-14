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
      data: makePage([{ ...donacionConfirmable, estado: 'OFRECIDA', organizacionId: null, modalidad: 'FONDO_COMUN' }]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as unknown as ReturnType<typeof useMisDonaciones>);

    renderPage();

    expect(screen.getByText(/fondo com[uú]n/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /ver detalle/i });
    expect(link).toHaveAttribute('href', '/mis-donaciones/1');
    expect(screen.getByText(/próxima ronda de asignación/i)).toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancelar donación…' }));

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

    await user.click(screen.getByRole('button', { name: 'Más acciones' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancelar donación…' }));
    await user.click(screen.getByRole('button', { name: 'Volver' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });
});

function mockLista(content: Donacion[], meta = {}) {
  vi.mocked(useMisDonaciones).mockReturnValue({
    data: makePage(content, meta),
    isLoading: false,
    isError: false,
    isFetching: false,
  } as unknown as ReturnType<typeof useMisDonaciones>);
}

describe('MisDonacionesPage — summary, tabs and actions', () => {
  const entregada: Donacion = { id: 2, estado: 'ENTREGADA', necesidadId: 5, organizacionId: 7 };
  const cancelada: Donacion = { id: 3, estado: 'CANCELADA', necesidadId: 5, organizacionId: 7 };
  const ofrecida: Donacion = { id: 4, estado: 'OFRECIDA', necesidadId: null, organizacionId: null, modalidad: 'FONDO_COMUN' };

  it('splits donations between Activas and Historial tabs', async () => {
    mockLista([donacionConfirmable, ofrecida, entregada, cancelada]);
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('tab', { name: 'Activas (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('article')).toHaveLength(2);

    await user.click(screen.getByRole('tab', { name: 'Historial (2)' }));

    expect(screen.getByRole('tab', { name: 'Historial (2)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('link', { name: /confirmar entrega/i })).not.toBeInTheDocument();
  });

  it('summarizes what needs action, what is in progress and what was delivered', () => {
    mockLista([donacionConfirmable, ofrecida, entregada]);
    renderPage();

    const stat = (label: string) => screen.getByText(label).previousElementSibling;
    expect(stat('Te toca actuar')).toHaveTextContent('1');
    expect(stat('En curso')).toHaveTextContent('2');
    expect(stat('Entregadas')).toHaveTextContent('1');
  });

  it('warns that counts only cover the loaded page when there are more pages', () => {
    mockLista([donacionConfirmable], { totalElements: 45 });
    renderPage();

    expect(screen.getByText(/solo las donaciones de esta página/i)).toBeInTheDocument();
  });

  it('does not warn when everything fits in one page', () => {
    mockLista([donacionConfirmable]);
    renderPage();

    expect(screen.queryByText(/solo las donaciones de esta página/i)).not.toBeInTheDocument();
  });

  it('offers exactly one primary action per row: confirm when actionable, otherwise view detail', () => {
    mockLista([donacionConfirmable, ofrecida]);
    renderPage();

    const [rowConfirm, rowOfrecida] = screen.getAllByRole('article');
    expect(within(rowConfirm).getByRole('link', { name: 'Confirmar entrega' })).toBeInTheDocument();
    expect(within(rowConfirm).queryByRole('link', { name: 'Ver detalle' })).not.toBeInTheDocument();
    expect(within(rowOfrecida).getByRole('link', { name: 'Ver detalle' })).toBeInTheDocument();
    expect(within(rowOfrecida).queryByRole('link', { name: 'Confirmar entrega' })).not.toBeInTheDocument();
  });

  it('shows the headline with articles and destination, and a status sentence', () => {
    mockLista([
      {
        ...donacionConfirmable,
        estado: 'ACEPTADA',
        organizacionNombre: 'Comedor Sol',
        fechaOferta: '2026-09-20',
        lineas: [{ articuloId: 1, articuloNombre: 'Arroz', unidad: 'KG', cantidad: 5 }],
      },
    ]);
    renderPage();

    expect(screen.getByText('5 kg Arroz → Comedor Sol')).toBeInTheDocument();
    expect(screen.getByText(/ofrecida el 20\/09\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/El comedor aceptó/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /progreso: asignación/i })).toBeInTheDocument();
  });

  it('shows only the articles while there is no destination yet', () => {
    mockLista([{ ...ofrecida, lineas: [{ articuloId: 1, articuloNombre: 'Arroz', unidad: 'KG', cantidad: 5 }] }]);
    renderPage();

    expect(screen.getByText('5 kg Arroz')).toBeInTheDocument();
  });

  it('keeps cancel out of the card: only the overflow menu offers it, and not for terminal donations', async () => {
    mockLista([ofrecida, entregada]);
    const user = userEvent.setup();
    renderPage();

    expect(screen.queryByRole('button', { name: /cancelar donación/i })).not.toBeInTheDocument();
    const [rowOfrecida] = screen.getAllByRole('article');
    await user.click(within(rowOfrecida).getByRole('button', { name: 'Más acciones' }));
    expect(screen.getByRole('menuitem', { name: 'Ver detalle' })).toHaveAttribute('href', '/mis-donaciones/4');
    expect(screen.getByRole('menuitem', { name: 'Cancelar donación…' })).toBeInTheDocument();
  });

  it('links the header action to the new donation flow', () => {
    mockLista([donacionConfirmable]);
    renderPage();

    expect(screen.getByRole('link', { name: '+ Nueva donación' })).toHaveAttribute('href', '/donar');
  });
});
