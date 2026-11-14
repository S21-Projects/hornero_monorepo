import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import RondasPage from './rondas';
import { useFondoRonda, useHistorialRondas, useEjecutarRonda, useAsignacionesRonda } from '../lib/hooks/useRondas';
import type { AsignacionRonda, RondaFondoResponse, RondaResponse } from '../types/domain';

vi.mock('../lib/hooks/useRondas', () => ({
  useFondoRonda: vi.fn(),
  useHistorialRondas: vi.fn(),
  useEjecutarRonda: vi.fn(),
  useAsignacionesRonda: vi.fn(),
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
      size: 10,
      totalElements: (overrides.content ?? [RONDA]).length,
      totalPages: overrides.totalPages ?? 1,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
  };
}

const EJECUTAR_MUTATE = vi.fn();

/** History rows are focusable `tr`s (no row role): find it through its origen badge. */
function historyRow(): HTMLElement {
  return screen.getByText('Manual').closest('tr') as HTMLElement;
}

const ASIGNACION: AsignacionRonda = {
  donacionId: 40,
  donacionDescripcion: 'Arroz x5, Leche x2',
  necesidadDescripcion: 'Necesitamos alimentos secos',
  asignacion: {
    id: 77,
    rondaId: 9,
    rondaFecha: '2026-09-20',
    necesidadId: 3,
    organizacionId: 8,
    organizacionNombre: 'Comedor Esperanza',
    estado: 'PROPUESTA',
    score: 0.81,
    costoOportunidad: 0,
    distanciaKm: 3.5,
    terminoDeficit: 0.9,
    terminoUrgencia: 0.8,
    terminoProximidad: 0.7,
    terminoEspera: 0.6,
    terminoCumplimiento: null,
    deficitFuente: 'RADIO',
    codigoRadio: '1',
    creadaEn: '2026-09-20T12:00:03Z',
    resueltaEn: null,
  },
};

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

    vi.mocked(useAsignacionesRonda).mockReturnValue({
      data: [ASIGNACION],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useAsignacionesRonda>);

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

    const fondo = within(screen.getByText('Fondo común').parentElement as HTMLElement);
    expect(fondo.getByText('3')).toBeInTheDocument();
    expect(fondo.getByText(/18\/09\/2026/)).toBeInTheDocument();
  });

  it('renders the history table with fecha, estado, asignadas, sinAsignar and ejecutada por', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    const row = historyRow();
    expect(within(row).getByText('Completada')).toBeInTheDocument();
    expect(within(row).getByText('Manual')).toBeInTheDocument();
    expect(within(row).getByText('2')).toBeInTheDocument();
    expect(within(row).getByText('1')).toBeInTheDocument();
    expect(within(row).getByText('1,42')).toBeInTheDocument();
  });

  it('requires a confirmation step before triggering the ronda', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: /ejecutar ronda/i }));
    expect(EJECUTAR_MUTATE).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('¿Ejecutar una ronda ahora?')).toBeInTheDocument();
    expect(within(dialog).getByText(/se van a considerar 3 donaciones/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /ejecutar ronda/i }));
    expect(EJECUTAR_MUTATE).toHaveBeenCalled();
  });

  it('does not run when the confirmation is cancelled', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: /ejecutar ronda/i }));
    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(EJECUTAR_MUTATE).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('disables the trigger when the pool is empty', () => {
    vi.mocked(useFondoRonda).mockReturnValue({
      data: { pendientes: 0, masAntiguaDesde: null },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useFondoRonda>);

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /ejecutar ronda/i })).toBeDisabled();
    expect(screen.getByText(/no hay donaciones en espera/i)).toBeInTheDocument();
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
    expect(screen.getByText('Sin asignar', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Donaciones consideradas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver detalle/i })).toBeInTheDocument();
  });

  it('shows the failure reason of a FALLIDA ronda', () => {
    vi.mocked(useHistorialRondas).mockReturnValue(
      historialPage({ content: [{ ...RONDA, estado: 'FALLIDA', error: 'Timeout del motor' }] }) as ReturnType<typeof useHistorialRondas>,
    );

    render(<RondasPage />, { wrapper: Wrapper });

    expect(screen.getByRole('alert')).toHaveTextContent('Timeout del motor');
  });

  it('opens a drawer with the ronda assignments when a history row is clicked', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    fireEvent.click(historyRow());

    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('Ronda #9')).toBeInTheDocument();
    expect(within(drawer).getByText(/Arroz x5, Leche x2 → Comedor Esperanza/)).toBeInTheDocument();
    expect(within(drawer).getByText('Necesitamos alimentos secos')).toBeInTheDocument();
    expect(within(drawer).getByText('Propuesta')).toBeInTheDocument();

    const toggle = within(drawer).getByRole('button', { name: /ver desglose/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(within(drawer).getByText('¿Por qué este destino?')).toBeInTheDocument();
  });

  it('shows the applied weights in the Resumen tab', () => {
    render(<RondasPage />, { wrapper: Wrapper });

    fireEvent.click(historyRow());
    fireEvent.click(screen.getByRole('tab', { name: 'Resumen' }));

    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('Pesos aplicados')).toBeInTheDocument();
    expect(within(drawer).getByRole('img', { name: 'Déficit de cobertura: 30%' })).toBeInTheDocument();
    expect(within(drawer).getByRole('img', { name: 'Cumplimiento histórico: 15%' })).toBeInTheDocument();
    expect(within(drawer).getByText('Ada Admin')).toBeInTheDocument();
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

    // Origen badge and "Ejecutada por" cell.
    expect(screen.getAllByText('Automática')).toHaveLength(2);
    expect(screen.queryByText(/Admin #/)).not.toBeInTheDocument();
  });
});
