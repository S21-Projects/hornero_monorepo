import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import RondasPage from './rondas';
import { useFondoRonda, useHistorialRondas, useEjecutarRonda } from '../lib/hooks/useRondas';
import type { RondaFondoResponse, RondaResponse } from '../types/domain';

vi.mock('../lib/hooks/useRondas', () => ({
  useFondoRonda: vi.fn(),
  useHistorialRondas: vi.fn(),
  useEjecutarRonda: vi.fn(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const RONDA: RondaResponse = {
  id: 9,
  ejecutadaEn: '2026-09-20T12:00:00Z',
  finalizadaEn: '2026-09-20T12:00:05Z',
  ejecutadaPor: 1,
  ejecutadaPorNombre: 'Ada Admin',
  origen: 'MANUAL',
  estado: 'COMPLETADA',
  error: null,
  versionContrato: 1,
  donacionesConsideradas: 5,
  candidatosConsiderados: 3,
  asignadas: 2,
  sinAsignar: 1,
  descartadas: 0,
  scoreTotal: 1.42,
  pesoDeficit: 0.3,
  pesoUrgencia: 0.25,
  pesoProximidad: 0.17,
  pesoEspera: 0.13,
  pesoCumplimiento: 0.15,
};

const FONDO: RondaFondoResponse = { pendientes: 3, masAntiguaDesde: '2026-09-18' };

function historialPage(overrides: Partial<{ content: RondaResponse[]; totalPages: number }> = {}) {
  return {
    data: {
      content: overrides.content ?? [RONDA],
      number: 0,
      size: 20,
      totalElements: (overrides.content ?? [RONDA]).length,
      totalPages: overrides.totalPages ?? 1,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
  };
}

const EJECUTAR_MUTATE = vi.fn();

describe('RondasPage — tasks 5f.12/5f.13 (admin ronda trigger and history)', () => {
  beforeEach(() => {
    vi.mocked(useFondoRonda).mockReturnValue({
      data: FONDO,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useFondoRonda>);

    vi.mocked(useHistorialRondas).mockReturnValue(
      historialPage() as ReturnType<typeof useHistorialRondas>,
    );

    EJECUTAR_MUTATE.mockReset();
    vi.mocked(useEjecutarRonda).mockReturnValue({
      mutate: EJECUTAR_MUTATE,
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useEjecutarRonda>);
  });

  it('shows the pool size and oldest waiting donación', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/18\/09\/2026/)).toBeInTheDocument();
  });

  it('renders the history table with fecha, estado, asignadas, sinAsignar and ejecutada por', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText('COMPLETADA')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('requires a confirmation step before triggering the ronda', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: /ejecutar ronda/i }));
    expect(EJECUTAR_MUTATE).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(EJECUTAR_MUTATE).toHaveBeenCalled();
  });

  it('disables the trigger button while a run is pending', () => {
    vi.mocked(useEjecutarRonda).mockReturnValue({
      mutate: EJECUTAR_MUTATE,
      isPending: true,
      isError: false,
      isSuccess: false,
      data: undefined,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useEjecutarRonda>);

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /ejecutar ronda/i })).toBeDisabled();
  });

  it('shows a result summary after a successful run', () => {
    vi.mocked(useEjecutarRonda).mockReturnValue({
      mutate: EJECUTAR_MUTATE,
      isPending: false,
      isError: false,
      isSuccess: true,
      data: RONDA,
      error: null,
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useEjecutarRonda>);

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText(/resultado de la última ronda/i)).toBeInTheDocument();
    expect(screen.getByText(/sin asignar: 1/i)).toBeInTheDocument();
  });

  it('shows a friendly message for a 409 (ronda en curso)', () => {
    vi.mocked(useEjecutarRonda).mockReturnValue({
      mutate: EJECUTAR_MUTATE,
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      error: { response: { status: 409 } },
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useEjecutarRonda>);

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText(/ya hay una ronda en curso/i)).toBeInTheDocument();
  });

  it('shows a friendly message for a 503 (worker no disponible)', () => {
    vi.mocked(useEjecutarRonda).mockReturnValue({
      mutate: EJECUTAR_MUTATE,
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      error: { response: { status: 503 } },
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useEjecutarRonda>);

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText(/motor de asignación no está disponible/i)).toBeInTheDocument();
  });

  it('shows the executor\'s name instead of "Admin #id" when ejecutadaPorNombre is present (T6)', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText('Ada Admin')).toBeInTheDocument();
    expect(screen.queryByText('Admin #1')).not.toBeInTheDocument();
  });

  it('falls back to "Admin #id" when ejecutadaPorNombre is null (executor account no longer exists)', () => {
    vi.mocked(useHistorialRondas).mockReturnValue(
      historialPage({ content: [{ ...RONDA, ejecutadaPorNombre: null }] }) as ReturnType<typeof useHistorialRondas>,
    );

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText('Admin #1')).toBeInTheDocument();
  });

  it('shows a friendly message for a 502 (respuesta inválida)', () => {
    vi.mocked(useEjecutarRonda).mockReturnValue({
      mutate: EJECUTAR_MUTATE,
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      error: { response: { status: 502 } },
      reset: vi.fn(),
    } as unknown as ReturnType<typeof useEjecutarRonda>);

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText(/respuesta inválida/i)).toBeInTheDocument();
  });
});

describe('RondasPage — origin of the ronda (N7)', () => {
  it('shows "Automática" with no executor name for a scheduled ronda', () => {
    vi.mocked(useHistorialRondas).mockReturnValue(
      historialPage({
        content: [{ ...RONDA, origen: 'AUTOMATICA', ejecutadaPor: null, ejecutadaPorNombre: null }],
      }) as ReturnType<typeof useHistorialRondas>,
    );

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByText('Automática')).toBeInTheDocument();
    expect(screen.queryByText(/Admin #/)).not.toBeInTheDocument();
  });
});
