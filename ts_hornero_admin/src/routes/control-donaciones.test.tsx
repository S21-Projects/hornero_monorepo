import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    data: { content, number: 0, size: 20, totalElements: content.length, totalPages: 1 },
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
});
