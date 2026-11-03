import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import ControlDonacionesPage from './control-donaciones';
import { useDonacionesActivas } from '../lib/hooks/useDonacionesActivas';
import { useOverrideEstadoDonacion } from '../lib/hooks/useOverrideEstadoDonacion';
import type { DonacionActiva } from '../types/domain';

vi.mock('../lib/hooks/useDonacionesActivas', () => ({
  useDonacionesActivas: vi.fn(),
}));
vi.mock('../lib/hooks/useOverrideEstadoDonacion', () => ({
  useOverrideEstadoDonacion: vi.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function donacionActivaPage(content: DonacionActiva[]) {
  return {
    data: { content, number: 0, size: 10, totalElements: content.length, totalPages: 1 },
    isLoading: false,
    isError: false,
    isFetching: false,
  };
}

describe('ControlDonacionesPage — T5 (modalidad + fase)', () => {
  beforeEach(() => {
    vi.mocked(useOverrideEstadoDonacion).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useOverrideEstadoDonacion>);
  });

  it('shows a "Fondo común" modalidad badge and the "En espera de asignación" fase for an EN_FONDO donación', () => {
    vi.mocked(useDonacionesActivas).mockReturnValue(
      donacionActivaPage([
        {
          id: 1,
          estado: 'OFRECIDA',
          necesidadId: 1,
          modalidad: 'FONDO_COMUN',
          fase: 'EN_FONDO',
        } as DonacionActiva,
      ]) as ReturnType<typeof useDonacionesActivas>,
    );

    render(<ControlDonacionesPage />, { wrapper: Wrapper });

    expect(screen.getByText('Fondo común')).toBeInTheDocument();
    expect(screen.getByText('En espera de asignación')).toBeInTheDocument();
  });

  it('shows a "Directa" modalidad badge for a DIRECTA donación and no fase badge beyond its estado', () => {
    vi.mocked(useDonacionesActivas).mockReturnValue(
      donacionActivaPage([
        {
          id: 2,
          estado: 'ACEPTADA',
          necesidadId: 1,
          modalidad: 'DIRECTA',
          fase: 'ACEPTADA',
        } as DonacionActiva,
      ]) as ReturnType<typeof useDonacionesActivas>,
    );

    render(<ControlDonacionesPage />, { wrapper: Wrapper });

    expect(screen.getByText('Directa')).toBeInTheDocument();
    expect(screen.queryByText('En espera de asignación')).not.toBeInTheDocument();
  });

  it('shows the donación lines when present (feature catalogo-articulos)', () => {
    vi.mocked(useDonacionesActivas).mockReturnValue(
      donacionActivaPage([
        {
          id: 3,
          estado: 'ACEPTADA',
          necesidadId: 1,
          modalidad: 'DIRECTA',
          fase: 'ACEPTADA',
          lineas: [
            { articuloId: 1, nombre: 'Arroz', unidad: 'KG', cantidad: 5 },
            { articuloId: 2, nombre: 'Fideos', unidad: 'PAQUETE', cantidad: 6 },
          ],
        } as DonacionActiva,
      ]) as ReturnType<typeof useDonacionesActivas>,
    );

    render(<ControlDonacionesPage />, { wrapper: Wrapper });

    expect(screen.getByText('5 kg Arroz, 6 paquetes Fideos')).toBeInTheDocument();
  });

  it('shows an "Estancada (N días)" badge only for stale donations (N12)', () => {
    vi.mocked(useDonacionesActivas).mockReturnValue(
      donacionActivaPage([
        { id: 4, estado: 'ACEPTADA', necesidadId: 1, estancada: true, diasEnEstado: 20 } as DonacionActiva,
        { id: 5, estado: 'ACEPTADA', necesidadId: 1, estancada: false, diasEnEstado: 2 } as DonacionActiva,
      ]) as ReturnType<typeof useDonacionesActivas>,
    );

    render(<ControlDonacionesPage />, { wrapper: Wrapper });

    expect(screen.getAllByText('Estancada (20 días)')).toHaveLength(1);
    expect(screen.queryByText(/Estancada \(2 días\)/)).not.toBeInTheDocument();
  });

  it('uses the singular for a single day', () => {
    vi.mocked(useDonacionesActivas).mockReturnValue(
      donacionActivaPage([
        { id: 6, estado: 'PENDIENTE_CONFIRMACION', necesidadId: 1, estancada: true, diasEnEstado: 1 } as DonacionActiva,
      ]) as ReturnType<typeof useDonacionesActivas>,
    );

    render(<ControlDonacionesPage />, { wrapper: Wrapper });

    expect(screen.getByText('Estancada (1 día)')).toBeInTheDocument();
  });

  it('the "Solo estancadas" toggle asks the server for estancadas=true', async () => {
    vi.mocked(useDonacionesActivas).mockReturnValue(
      donacionActivaPage([]) as ReturnType<typeof useDonacionesActivas>,
    );

    render(<ControlDonacionesPage />, { wrapper: Wrapper });
    expect(vi.mocked(useDonacionesActivas)).toHaveBeenLastCalledWith(
      expect.objectContaining({ estancadas: undefined }),
    );

    await userEvent.click(screen.getByRole('button', { name: /solo estancadas/i }));

    expect(vi.mocked(useDonacionesActivas)).toHaveBeenLastCalledWith(
      expect.objectContaining({ estancadas: true, page: 0 }),
    );
    expect(screen.getByRole('button', { name: /solo estancadas/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ControlDonacionesPage — drawer', () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    mutateAsync.mockReset().mockResolvedValue({});
    vi.mocked(useOverrideEstadoDonacion).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
    } as unknown as ReturnType<typeof useOverrideEstadoDonacion>);
    vi.mocked(useDonacionesActivas).mockReturnValue(
      donacionActivaPage([
        {
          id: 7,
          estado: 'ACEPTADA',
          necesidadId: 1,
          donanteNombre: 'Dora Donante',
          organizacionNombre: 'Comedor Sol',
          necesidadDescripcion: 'Necesitamos arroz y fideos para la semana entera de comidas',
          estancada: true,
          diasEnEstado: 12,
          overrideEn: '2026-10-01T10:00:00Z',
          overrideAdminId: 3,
          overrideMotivo: 'Corrección manual',
          lineas: [{ articuloId: 1, nombre: 'Arroz', unidad: 'KG', cantidad: 5 }],
        } as DonacionActiva,
      ]) as ReturnType<typeof useDonacionesActivas>,
    );
  });

  it('opens the detail drawer from any click on the row, with the full detail', async () => {
    const user = userEvent.setup();
    render(<ControlDonacionesPage />, { wrapper: Wrapper });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByText('Dora Donante'));

    const dialog = screen.getByRole('dialog', { name: 'Comedor Sol' });
    expect(dialog).toHaveTextContent('Necesitamos arroz y fideos para la semana entera de comidas');
    expect(dialog).toHaveTextContent('5 kg Arroz');
    expect(dialog).toHaveTextContent('Corrección manual');
    expect(screen.getByRole('alert')).toHaveTextContent(/estancada/i);
    expect(screen.getByRole('tab', { name: 'Detalle' })).toHaveAttribute('aria-selected', 'true');
  });

  it('forces the estado from the second tab only once estado and motivo are set', async () => {
    const user = userEvent.setup();
    render(<ControlDonacionesPage />, { wrapper: Wrapper });
    await user.click(screen.getByText('Dora Donante'));

    await user.click(screen.getByRole('button', { name: 'Forzar estado…' }));
    const submit = screen.getByRole('button', { name: 'Forzar estado' });
    expect(submit).toBeDisabled();

    await user.selectOptions(screen.getByLabelText('Nuevo estado'), 'CANCELADA');
    await user.type(screen.getByLabelText(/Motivo/), '  Pedido del donante ');
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(mutateAsync).toHaveBeenCalledWith({ id: 7, estado: 'CANCELADA', motivo: 'Pedido del donante' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes with Cerrar without forcing anything', async () => {
    const user = userEvent.setup();
    render(<ControlDonacionesPage />, { wrapper: Wrapper });
    await user.click(screen.getByText('Dora Donante'));

    const cerrar = screen.getAllByRole('button', { name: 'Cerrar' });
    await user.click(cerrar[cerrar.length - 1]); // footer button (the X comes first)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
