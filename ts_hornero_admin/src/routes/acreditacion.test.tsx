import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AcreditacionPage from './acreditacion';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useLegajo } from '../lib/hooks/useAcreditacion';
import type { LegajoResponse, Organizacion } from '../types/domain';

vi.mock('../lib/hooks/useMisOrganizaciones', () => ({
  useMisOrganizaciones: vi.fn(),
}));

vi.mock('../lib/hooks/useAcreditacion', async () => {
  const actual = await vi.importActual<typeof import('../lib/hooks/useAcreditacion')>(
    '../lib/hooks/useAcreditacion',
  );
  return {
    ...actual,
    useLegajo: vi.fn(),
  };
});

// task 2.24 (AD-12 follow-up): the referente's own view stubs EvidenciaArchivo here —
// EvidenciaArchivo's own rendering behavior is covered by EvidenciaArchivo.test.tsx.
vi.mock('../components/acreditacion/EvidenciaArchivo', () => ({
  EvidenciaArchivo: ({ objectKey }: { objectKey: string | null | undefined }) => (
    <div data-testid="evidencia-archivo">{objectKey}</div>
  ),
}));

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const ORGANIZACION: Organizacion = {
  id: 5,
  slug: 'comedor-los-hornitos',
  nombre: 'Comedor Los Hornitos',
  validada: true,
  estado: 'APROBADA',
  aceptaDonaciones: false,
};

const BASE_REQUISITO = {
  requisito: 'NO_DISCRIMINACION' as const,
  nivelExigido: 'N1' as const,
  estado: 'PENDIENTE' as const,
  tipoEvidencia: 'DECLARACION' as const,
  declaracion: 'No discriminamos',
  validoDesde: '2026-01-01',
  validoHasta: null,
  expirada: false,
  auditorNombre: null,
  auditadoEn: null,
  objectKey: null,
};

function buildLegajo(requisitos: LegajoResponse['requisitos']): LegajoResponse {
  return {
    organizacionId: 5,
    nombre: 'Comedor Los Hornitos',
    slug: 'comedor-los-hornitos',
    direccion: 'Av. Colón 1234',
    nivel: 'N1',
    nivelDesde: '2026-01-01T00:00:00Z',
    requisitos,
    eventos: [],
    disclosure: 'Datos declarados y auditados, no verificados por el sistema.',
  };
}

describe('AcreditacionPage — task 2.24 (AD-12 follow-up)', () => {
  beforeEach(() => {
    vi.mocked(useMisOrganizaciones).mockReturnValue({
      data: [ORGANIZACION],
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useMisOrganizaciones>);
  });

  it('renders EvidenciaArchivo for a FOTO requisito with a known objectKey', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([
        {
          ...BASE_REQUISITO,
          requisito: 'CONDICIONES_SANITARIAS_ADECUADAS',
          tipoEvidencia: 'FOTO',
          declaracion: null,
          objectKey: 'org-evidencia/5/foto.jpg',
        },
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByTestId('evidencia-archivo')).toHaveTextContent('org-evidencia/5/foto.jpg');
  });

  it('renders EvidenciaArchivo for a DOCUMENTO requisito with a known objectKey', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([
        {
          ...BASE_REQUISITO,
          requisito: 'RADIO_50KM_BANCO_ALIMENTOS',
          tipoEvidencia: 'DOCUMENTO',
          declaracion: null,
          objectKey: 'org-evidencia/5/doc.pdf',
        },
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByTestId('evidencia-archivo')).toHaveTextContent('org-evidencia/5/doc.pdf');
  });

  it('renders human labels for requisito codes and falls back to the raw code when unknown', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([
        BASE_REQUISITO,
        { ...BASE_REQUISITO, requisito: 'SERVICIO_REGULAR_GRATUITO' },
        { ...BASE_REQUISITO, requisito: 'CODIGO_NUEVO' as never },
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.getByText('Sin discriminación')).toBeInTheDocument();
    expect(screen.getByText('Servicio regular y gratuito')).toBeInTheDocument();
    expect(screen.queryByText('NO_DISCRIMINACION')).not.toBeInTheDocument();
    expect(screen.getByText('CODIGO_NUEVO')).toBeInTheDocument();
  });

  it('does not render EvidenciaArchivo for a DECLARACION requisito', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([BASE_REQUISITO]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.queryByTestId('evidencia-archivo')).not.toBeInTheDocument();
  });

  it('does not render EvidenciaArchivo for a FALTANTE FOTO requisito with no objectKey yet', () => {
    vi.mocked(useLegajo).mockReturnValue({
      data: buildLegajo([
        {
          ...BASE_REQUISITO,
          requisito: 'CONDICIONES_SANITARIAS_ADECUADAS',
          estado: 'FALTANTE',
          tipoEvidencia: null,
          declaracion: null,
          objectKey: null,
        },
      ]),
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useLegajo>);

    render(<AcreditacionPage />, { wrapper: Wrapper });

    expect(screen.queryByTestId('evidencia-archivo')).not.toBeInTheDocument();
  });
});
