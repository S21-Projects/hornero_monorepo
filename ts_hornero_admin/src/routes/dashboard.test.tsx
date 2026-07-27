import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from './dashboard';
import { useMiOrganizacion } from '../lib/hooks/useMiOrganizacion';
import { useNecesidadesDeOrg } from '../lib/hooks/useNecesidadesDeOrg';
import { useDonacionesDeMiOrg } from '../lib/hooks/useDonacionesDeMiOrg';
import type { Organizacion, Necesidad, Donacion } from '../types/domain';

vi.mock('../lib/hooks/useMiOrganizacion', () => ({
  useMiOrganizacion: vi.fn(),
}));
vi.mock('../lib/hooks/useNecesidadesDeOrg', () => ({
  useNecesidadesDeOrg: vi.fn(),
}));
vi.mock('../lib/hooks/useDonacionesDeMiOrg', () => ({
  useDonacionesDeMiOrg: vi.fn(),
}));

function mockOrganizacion(data: Organizacion | undefined, overrides = {}) {
  vi.mocked(useMiOrganizacion).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useMiOrganizacion>);
}

function mockNecesidades(data: Necesidad[] | undefined, overrides = {}) {
  vi.mocked(useNecesidadesDeOrg).mockReturnValue({
    data,
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

const organizacion: Organizacion = {
  id: 7,
  nombre: 'Comedor Sol',
  slug: 'comedor-sol',
  tipo: 'COMEDOR',
  descripcion: '',
  direccion: '',
  estado: 'APROBADA',
} as Organizacion;

const necesidades: Necesidad[] = [
  { id: 1, titulo: 'Arroz', estado: 'ABIERTA' } as Necesidad,
  { id: 2, titulo: 'Fideos', estado: 'CUMPLIDA' } as Necesidad,
];

const donaciones: Donacion[] = [
  { id: 1, estado: 'OFRECIDA' } as Donacion,
  { id: 2, estado: 'ENTREGADA' } as Donacion,
];

describe('DashboardPage', () => {
  it('renders both chart sections when the org has necesidades and donaciones', () => {
    mockOrganizacion(organizacion);
    mockNecesidades(necesidades);
    mockDonaciones(donaciones);

    render(<DashboardPage />);

    expect(screen.getByText('Necesidades por estado')).toBeInTheDocument();
    expect(screen.getByText('Donaciones recibidas')).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay/)).not.toBeInTheDocument();
  });

  it('renders empty states when the org has no necesidades or donaciones', () => {
    mockOrganizacion(organizacion);
    mockNecesidades([]);
    mockDonaciones([]);

    render(<DashboardPage />);

    expect(screen.getByText('Todavía no hay necesidades cargadas.')).toBeInTheDocument();
    expect(screen.getByText('Todavía no hay donaciones recibidas.')).toBeInTheDocument();
  });

  it('renders the loading state via AsyncSection while org is loading', () => {
    mockOrganizacion(undefined, { isLoading: true });
    mockNecesidades(undefined, { isLoading: true });
    mockDonaciones(undefined, { isLoading: true });

    render(<DashboardPage />);

    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('renders the error state via AsyncSection when a fetch fails', () => {
    mockOrganizacion(organizacion);
    mockNecesidades(undefined, { isError: true });
    mockDonaciones(undefined, { isError: true });

    render(<DashboardPage />);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });
});
