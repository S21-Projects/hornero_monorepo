import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import AuditoriaPage from './auditoria';
import { useColaAuditoria } from '../lib/hooks/useColaAuditoria';
import { useAuditarEvidencia } from '../lib/hooks/useAcreditacion';
import type { EvidenciaEnColaResponse } from '../types/domain';

vi.mock('../lib/hooks/useColaAuditoria', () => ({
  useColaAuditoria: vi.fn(),
}));

vi.mock('../lib/hooks/useAcreditacion', async () => {
  const actual = await vi.importActual<typeof import('../lib/hooks/useAcreditacion')>(
    '../lib/hooks/useAcreditacion',
  );
  return {
    ...actual,
    useAuditarEvidencia: vi.fn(),
  };
});

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

const ROW: EvidenciaEnColaResponse = {
  id: 7,
  organizacionId: 3,
  organizacionNombre: 'Comedor Los Hornitos',
  organizacionNivel: 'N1',
  requisito: 'NO_DISCRIMINACION',
  nivelExigido: 'N1',
  tipoEvidencia: 'DECLARACION',
  declaracion: 'No discriminamos',
  validoDesde: '2026-01-01',
  validoHasta: null,
  estado: 'PENDIENTE',
  expirada: false,
  cargadoEn: '2026-01-05T00:00:00Z',
};

function pageOf(content: EvidenciaEnColaResponse[], overrides: Partial<{ number: number; totalPages: number; totalElements: number }> = {}) {
  return {
    content,
    number: overrides.number ?? 0,
    size: 10,
    totalElements: overrides.totalElements ?? content.length,
    totalPages: overrides.totalPages ?? 1,
  };
}

const AUDITAR_MUTATE = vi.fn();

describe('AuditoriaPage — task 4b.3/4b.4 (cross-org audit queue screen)', () => {
  beforeEach(() => {
    vi.mocked(useColaAuditoria).mockReturnValue({
      data: pageOf([ROW]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as ReturnType<typeof useColaAuditoria>);

    AUDITAR_MUTATE.mockReset();
    vi.mocked(useAuditarEvidencia).mockReturnValue({
      mutateAsync: AUDITAR_MUTATE,
      isPending: false,
      isError: false,
      variables: undefined,
    } as unknown as ReturnType<typeof useAuditarEvidencia>);
  });

  it('requests PENDIENTES on mount, at page 0', () => {
    render(<AuditoriaPage />, { wrapper: Wrapper });

    expect(useColaAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'PENDIENTES', page: 0 }),
    );
  });

  it('switching to the Vencidas tab resets to page 0 and changes the query key', () => {
    render(<AuditoriaPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: /vencidas/i }));

    expect(useColaAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'VENCIDAS', page: 0 }),
    );
  });

  it('changing the requisito filter resets to page 0', () => {
    render(<AuditoriaPage />, { wrapper: Wrapper });

    const dropdowns = screen.getAllByRole('button', { name: /todos/i });
    fireEvent.click(dropdowns[1]); // requisito dropdown
    fireEvent.click(screen.getByRole('option', { name: 'Sin discriminación' }));

    expect(useColaAuditoria).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 0, requisito: 'NO_DISCRIMINACION' }),
    );
  });

  it('shows the human requisito label in the table, not the raw code', () => {
    render(<AuditoriaPage />, { wrapper: Wrapper });

    expect(screen.getByText('Sin discriminación')).toBeInTheDocument();
    expect(screen.queryByText('NO_DISCRIMINACION')).not.toBeInTheDocument();
  });

  it('renders the pager when there is more than one page', () => {
    vi.mocked(useColaAuditoria).mockReturnValue({
      data: pageOf([ROW], { totalPages: 3, totalElements: 45 }),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as ReturnType<typeof useColaAuditoria>);

    render(<AuditoriaPage />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /página siguiente/i })).toBeInTheDocument();
  });

  it('selecting a row opens the existing detail view with Aprobar/Observar', () => {
    render(<AuditoriaPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: /ver detalle/i }));

    expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /observar/i })).toBeInTheDocument();
  });

  it('approving from the opened detail calls the existing mutation and clears the row on refresh', async () => {
    AUDITAR_MUTATE.mockResolvedValue({ id: 7, estado: 'APROBADA' });

    const { rerender } = render(<AuditoriaPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByRole('button', { name: /ver detalle/i }));
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }));

    expect(AUDITAR_MUTATE).toHaveBeenCalledWith({
      organizacionId: 3,
      evidenciaId: 7,
      accion: 'aprobar',
    });

    // Simulate the query invalidation refetch (useAuditarEvidencia's onSuccess invalidates
    // ['auditoria','cola'] per task 4b.5) removing the now-approved row from Pendientes.
    vi.mocked(useColaAuditoria).mockReturnValue({
      data: pageOf([]),
      isLoading: false,
      isError: false,
      isFetching: false,
    } as ReturnType<typeof useColaAuditoria>);
    rerender(<AuditoriaPage />);

    expect(screen.queryByText('Comedor Los Hornitos')).not.toBeInTheDocument();
  });

  describe('RN-04 expired evidence', () => {
    const VENCIDA_ROW: EvidenciaEnColaResponse = {
      ...ROW,
      estado: 'VENCIDA',
      expirada: true,
      validoHasta: '2026-10-01',
      graciaHasta: '2026-10-31',
      graciaVencida: false,
    };

    function mockVencidas(row: EvidenciaEnColaResponse) {
      vi.mocked(useColaAuditoria).mockReturnValue({
        data: pageOf([row]),
        isLoading: false,
        isError: false,
        isFetching: false,
      } as ReturnType<typeof useColaAuditoria>);
    }

    it('shows the VENCIDA state, the expiry date and the end of grace', () => {
      mockVencidas(VENCIDA_ROW);
      render(<AuditoriaPage />, { wrapper: Wrapper });

      expect(screen.getByText('Vencida')).toBeInTheDocument();
      expect(screen.getByText('Venció el 01/10/2026')).toBeInTheDocument();
      expect(screen.getByText('En gracia hasta el 31/10/2026')).toBeInTheDocument();
      expect(screen.queryByText('Gracia vencida')).not.toBeInTheDocument();
    });

    it('flags the organization as "Gracia vencida" once the grace period is over', () => {
      mockVencidas({ ...VENCIDA_ROW, graciaVencida: true });
      render(<AuditoriaPage />, { wrapper: Wrapper });

      expect(screen.getByText('Gracia vencida')).toBeInTheDocument();
      expect(screen.queryByText(/En gracia hasta/)).not.toBeInTheDocument();
    });

    it('does not offer Aprobar for a VENCIDA row (it has to be replaced)', () => {
      mockVencidas(VENCIDA_ROW);
      render(<AuditoriaPage />, { wrapper: Wrapper });

      fireEvent.click(screen.getByRole('button', { name: /ver detalle/i }));

      expect(screen.queryByRole('button', { name: /^aprobar$/i })).not.toBeInTheDocument();
    });
  });
});
