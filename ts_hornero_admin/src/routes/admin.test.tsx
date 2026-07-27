import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminPage from './admin';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import type { OrganizacionAdmin, Usuario } from '../types/domain';

vi.mock('../lib/hooks/useOrganizacionesPendientes', () => ({
  useOrganizacionesPendientes: vi.fn(),
}));
vi.mock('../lib/hooks/useUsuarios', () => ({
  useUsuarios: vi.fn(),
}));

function mockPendientes(data: OrganizacionAdmin[] | undefined, overrides = {}) {
  vi.mocked(useOrganizacionesPendientes).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useOrganizacionesPendientes>);
}

function mockUsuarios(data: Usuario[] | undefined, overrides = {}) {
  vi.mocked(useUsuarios).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useUsuarios>);
}

const pendientes: OrganizacionAdmin[] = [
  {
    id: 1,
    nombre: 'Comedor Sol',
    slug: 'comedor-sol',
    tipo: 'COMEDOR',
    descripcion: '',
    direccion: '',
    estado: 'PENDIENTE',
    referenteNombre: 'Ana',
    referenteEmail: 'ana@example.com',
  },
];

const usuarios: Usuario[] = [
  { id: 1, nombre: 'Ana', email: 'ana@example.com', tipo: 'ADMINISTRADOR', activo: true },
  { id: 2, nombre: 'Beto', email: 'beto@example.com', tipo: 'REFERENTE', activo: true },
  { id: 3, nombre: 'Caro', email: 'caro@example.com', tipo: 'DONANTE', activo: false },
];

describe('AdminPage', () => {
  it('renders the stat cards and charts when data is present', () => {
    mockPendientes(pendientes);
    mockUsuarios(usuarios);

    render(<AdminPage />);

    expect(screen.getByText('Organizaciones pendientes')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Total de usuarios')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Usuarios activos')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Usuarios por rol')).toBeInTheDocument();
    expect(screen.getByText('Usuarios activos vs. inactivos')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay usuarios cargados.')).not.toBeInTheDocument();
  });

  it('renders a chart empty state when there are no usuarios', () => {
    mockPendientes([]);
    mockUsuarios([]);

    render(<AdminPage />);

    expect(screen.getAllByText('Todavía no hay usuarios cargados.')).toHaveLength(2);
  });

  it('renders the loading state via AsyncSection', () => {
    mockPendientes(undefined, { isLoading: true });
    mockUsuarios(undefined, { isLoading: true });

    render(<AdminPage />);

    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('renders the error state via AsyncSection', () => {
    mockPendientes(undefined, { isError: true });
    mockUsuarios(undefined, { isError: true });

    render(<AdminPage />);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });
});
