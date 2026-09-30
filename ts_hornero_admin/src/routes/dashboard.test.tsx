import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './dashboard';
import { useMisOrganizaciones } from '../lib/hooks/useMisOrganizaciones';
import { useNecesidadesDeOrg } from '../lib/hooks/useNecesidadesDeOrg';
import { useDonacionesDeMiOrg } from '../lib/hooks/useDonacionesDeMiOrg';
import { useDecidirDonacion } from '../lib/hooks/useDecidirDonacion';
import { makePage } from '../test/fixtures/page';
import type { Organizacion, Necesidad, Donacion } from '../types/domain';

vi.mock('../lib/hooks/useMisOrganizaciones', () => ({
  useMisOrganizaciones: vi.fn(),
}));
vi.mock('../lib/hooks/useNecesidadesDeOrg', () => ({
  useNecesidadesDeOrg: vi.fn(),
}));
vi.mock('../lib/hooks/useDonacionesDeMiOrg', () => ({
  useDonacionesDeMiOrg: vi.fn(),
}));
vi.mock('../lib/hooks/useDecidirDonacion', () => ({
  useDecidirDonacion: vi.fn(),
}));

function mockOrganizacion(data: Organizacion[] | undefined, overrides = {}) {
  vi.mocked(useMisOrganizaciones).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useMisOrganizaciones>);
}

function mockNecesidades(data: Necesidad[] | undefined, overrides = {}) {
  vi.mocked(useNecesidadesDeOrg).mockReturnValue({
    data: data ? makePage(data) : undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useNecesidadesDeOrg>);
}

function mockDonaciones(data: Donacion[] | undefined, overrides = {}) {
  vi.mocked(useDonacionesDeMiOrg).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useDonacionesDeMiOrg>);
}

vi.mocked(useDecidirDonacion).mockReturnValue({
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  variables: undefined,
} as unknown as ReturnType<typeof useDecidirDonacion>);

const organizacion: Organizacion = {
  id: 7,
  slug: 'comedor-sol',
  nombre: 'Comedor Sol',
  validada: true,
  estado: 'APROBADA',
  aceptaDonaciones: false,
};

const necesidades: Necesidad[] = [
  { id: 1, descripcion: 'Arroz', prioridad: 'URGENTE', estado: 'ABIERTA', organizacionId: 7 },
  { id: 2, descripcion: 'Fideos', prioridad: 'NORMAL', estado: 'CUMPLIDA', organizacionId: 7 },
];

const donaciones: Donacion[] = [
  { id: 1, estado: 'OFRECIDA', necesidadId: 1, organizacionId: 7 },
  { id: 2, estado: 'ENTREGADA', necesidadId: 2, organizacionId: 7 },
];

describe('DashboardPage', () => {
  it('renders both chart sections when the org has necesidades and donaciones', () => {
    mockOrganizacion([organizacion]);
    mockNecesidades(necesidades);
    mockDonaciones(donaciones);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText('Necesidades por estado')).toBeInTheDocument();
    expect(screen.getByText('Donaciones recibidas')).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay/)).not.toBeInTheDocument();
  });

  it('renders empty states when the org has no necesidades or donaciones', () => {
    mockOrganizacion([organizacion]);
    mockNecesidades([]);
    mockDonaciones([]);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText('Todavía no hay necesidades cargadas.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay donaciones recibidas.')).toBeInTheDocument();
  });

  it('renders the loading skeleton via AsyncSection while org is loading', () => {
    mockOrganizacion(undefined, { isLoading: true });
    mockNecesidades(undefined, { isLoading: true });
    mockDonaciones(undefined, { isLoading: true });

    const { container } = render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
    expect(screen.queryByText('Resumen de')).not.toBeInTheDocument();
  });

  it('renders the error state via AsyncSection when a fetch fails', () => {
    mockOrganizacion([organizacion]);
    mockNecesidades(undefined, { isError: true });
    mockDonaciones(undefined, { isError: true });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });

  // Task 3c.15/16 — the plain "Confirmar entrega" button is retired in favour of a link to the
  // code-verified confirmation screen, spec `donacion-entrega-codigo`'s retirement requirement.
  it('shows a "Confirmar entrega" link to the new screen for a donación pending the referente\'s confirmation', () => {
    mockOrganizacion([organizacion]);
    mockNecesidades(necesidades);
    mockDonaciones([{ id: 3, estado: 'EN_CAMINO', necesidadId: 1, organizacionId: 7 }]);

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    const link = screen.getByRole('link', { name: /confirmar entrega/i });
    expect(link).toHaveAttribute('href', '/donaciones/3/entrega');
  });
});
