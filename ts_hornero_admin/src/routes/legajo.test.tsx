import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import LegajoPage from './legajo';
import { useAuthStore } from '../store/auth.store';
import { useLegajo, useEvidenciasPendientes } from '../lib/hooks/useAcreditacion';
import type { LegajoResponse, EvidenciaResponse } from '../types/domain';

vi.mock('../lib/hooks/useAcreditacion', async () => {
  const actual = await vi.importActual<typeof import('../lib/hooks/useAcreditacion')>(
    '../lib/hooks/useAcreditacion',
  );
  return {
    ...actual,
    useLegajo: vi.fn(),
    useEvidenciasPendientes: vi.fn(),
  };
});

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/organizaciones/5/legajo']}>
        <Routes>
          <Route path="/organizaciones/:id/legajo" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const LEGAJO: LegajoResponse = {
  organizacionId: 5,
  nombre: 'Comedor Los Hornitos',
  slug: 'comedor-los-hornitos',
  direccion: 'Av. Colón 1234',
  nivel: 'N1',
  nivelDesde: '2026-01-01T00:00:00Z',
  requisitos: [
    {
      requisito: 'NO_DISCRIMINACION',
      nivelExigido: 'N1',
      estado: 'PENDIENTE',
      tipoEvidencia: 'DECLARACION',
      declaracion: 'No discriminamos',
      validoDesde: '2026-01-01',
      validoHasta: null,
      expirada: false,
      auditorNombre: null,
      auditadoEn: null,
    },
  ],
  eventos: [],
  cumplimiento: { entregadas: 3, rechazadas: 1, tasa: 0.75 },
  disclosure: 'Datos declarados y auditados, no verificados por el sistema.',
};

const PENDIENTE_EVIDENCIA: EvidenciaResponse = {
  id: 42,
  organizacionId: 5,
  requisito: 'NO_DISCRIMINACION',
  tipoEvidencia: 'DECLARACION',
  estado: 'PENDIENTE',
  expirada: false,
};

describe('LegajoPage — task 4b.6 (D-02 wiring)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        userId: 2,
        nombre: 'Admin',
        email: 'admin@test.com',
        tipo: 'ADMINISTRADOR',
        emailVerificado: true,
      },
    });
    vi.mocked(useLegajo).mockReturnValue({
      data: LEGAJO,
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);
  });

  it('feeds the real evidenciaIds map into AuditQueue so an admin can approve a pending requisito', () => {
    vi.mocked(useEvidenciasPendientes).mockReturnValue({
      data: [PENDIENTE_EVIDENCIA],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useEvidenciasPendientes>);

    render(<LegajoPage />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument();
  });

  it('renders no approve button when the evidence queue has not loaded yet', () => {
    vi.mocked(useEvidenciasPendientes).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as ReturnType<typeof useEvidenciasPendientes>);

    render(<LegajoPage />, { wrapper: Wrapper });

    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
  });

  it('shows a VENCIDA requisito in Spanish with the grace badge in the audit list', () => {
    vi.mocked(useEvidenciasPendientes).mockReturnValue({
      data: [] as EvidenciaResponse[],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useEvidenciasPendientes>);
    vi.mocked(useLegajo).mockReturnValue({
      data: {
        ...LEGAJO,
        requisitos: [
          {
            ...LEGAJO.requisitos[0],
            estado: 'VENCIDA',
            expirada: true,
            validoHasta: '2026-09-01',
            graciaHasta: '2026-10-01',
            graciaVencida: true,
          },
        ],
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<LegajoPage />, { wrapper: Wrapper });

    expect(screen.getAllByText('Vencida').length).toBeGreaterThan(0);
    expect(screen.getByText('Gracia vencida')).toBeInTheDocument();
    expect(screen.queryByText(/Vencida · Vencida/)).not.toBeInTheDocument();
  });

  it('shows delivered and rejected counts, the rate and the note about the round term', () => {
    vi.mocked(useEvidenciasPendientes).mockReturnValue({
      data: [] as EvidenciaResponse[],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useEvidenciasPendientes>);

    render(<LegajoPage />, { wrapper: Wrapper });

    expect(screen.getByText('Historial de cumplimiento')).toBeInTheDocument();
    expect(screen.getByText('Entregadas: 3')).toBeInTheDocument();
    expect(screen.getByText('Rechazadas: 1')).toBeInTheDocument();
    expect(screen.getByText('Tasa de cumplimiento: 75 %')).toBeInTheDocument();
    expect(screen.getByText(/suavizado/i)).toBeInTheDocument();
    expect(screen.getByText(/sin responder/i)).toBeInTheDocument();
  });

  it('shows "Sin historial" when the rate is null', () => {
    vi.mocked(useEvidenciasPendientes).mockReturnValue({
      data: [] as EvidenciaResponse[],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useEvidenciasPendientes>);
    vi.mocked(useLegajo).mockReturnValue({
      data: { ...LEGAJO, cumplimiento: { entregadas: 0, rechazadas: 0, tasa: null } },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<LegajoPage />, { wrapper: Wrapper });

    expect(screen.getByText('Tasa de cumplimiento: Sin historial')).toBeInTheDocument();
  });
});
