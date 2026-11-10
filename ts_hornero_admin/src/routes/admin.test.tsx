import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from './admin';
import { useOrganizacionesPendientes } from '../lib/hooks/useOrganizacionesPendientes';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { makePage } from '../test/fixtures/page';
import type { OrganizacionAdmin, Usuario } from '../types/domain';

vi.mock('../lib/hooks/useOrganizacionesPendientes', () => ({
  useOrganizacionesPendientes: vi.fn(),
}));
vi.mock('../lib/hooks/useUsuarios', () => ({
  useUsuarios: vi.fn(),
}));

function mockPendientes(data: OrganizacionAdmin[] | undefined, overrides = {}) {
  vi.mocked(useOrganizacionesPendientes).mockReturnValue({
    data: data ? makePage(data, { totalElements: data.length }) : undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useOrganizacionesPendientes>);
}

/** The page asks for counts only (size 1 + tipo/activo filters), so answer each filter with its total. */
function mockUsuarios(data: Usuario[] | undefined, overrides = {}) {
  vi.mocked(useUsuarios).mockImplementation(((params?: { tipo?: string; activo?: boolean }) => {
    const matching = (data ?? []).filter(
      (u) => (!params?.tipo || u.tipo === params.tipo) && (!params?.activo || u.activo),
    );
    return {
      data: data ? makePage([], { totalElements: matching.length, size: 1 }) : undefined,
      isLoading: false,
      isError: false,
      ...overrides,
    };
  }) as unknown as typeof useUsuarios);
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
    aceptaDonaciones: false,
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

    render(<MemoryRouter><AdminPage /></MemoryRouter>);

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

  it('asks for counts only, one query per role plus the active ones', () => {
    mockPendientes(pendientes);
    mockUsuarios(usuarios);

    render(<MemoryRouter><AdminPage /></MemoryRouter>);

    const calls = vi.mocked(useUsuarios).mock.calls.map(([params]) => params);
    expect(calls).toEqual(
      expect.arrayContaining([
        { page: 0, size: 1, tipo: 'ADMINISTRADOR' },
        { page: 0, size: 1, tipo: 'REFERENTE' },
        { page: 0, size: 1, tipo: 'DONANTE' },
        { page: 0, size: 1, activo: true },
      ]),
    );
  });

  it('renders a chart empty state when there are no usuarios', () => {
    mockPendientes([]);
    mockUsuarios([]);

    render(<MemoryRouter><AdminPage /></MemoryRouter>);

    expect(screen.getAllByText('Todavía no hay usuarios cargados.')).toHaveLength(2);
  });

  it('renders the loading state via AsyncSection', () => {
    mockPendientes(undefined, { isLoading: true });
    mockUsuarios(undefined, { isLoading: true });

    render(<MemoryRouter><AdminPage /></MemoryRouter>);

    expect(screen.getByText('Cargando…')).toBeInTheDocument();
  });

  it('renders the error state via AsyncSection', () => {
    mockPendientes(undefined, { isError: true });
    mockUsuarios(undefined, { isError: true });

    render(<MemoryRouter><AdminPage /></MemoryRouter>);

    expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
  });
});
