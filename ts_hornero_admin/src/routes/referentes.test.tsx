import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReferentesPage from './referentes';
import { useUsuarios } from '../lib/hooks/useUsuarios';
import { useOrganizacionesAdmin } from '../lib/hooks/useOrganizacionesAdmin';
import { makePage } from '../test/fixtures/page';
import type { OrganizacionAdmin, Usuario } from '../types/domain';

vi.mock('../lib/hooks/useUsuarios', () => ({ useUsuarios: vi.fn() }));
vi.mock('../lib/hooks/useOrganizacionesAdmin', () => ({ useOrganizacionesAdmin: vi.fn() }));
vi.mock('../lib/hooks/usePageClamp', () => ({ usePageClamp: vi.fn() }));
vi.mock('../lib/hooks/useAsignarReferente', () => ({
  useAsignarReferente: () => ({ mutate: vi.fn(), isPending: false, isError: false, variables: undefined, error: null }),
}));
vi.mock('../lib/hooks/useAdminInfoPublica', () => ({
  useAdminInfoPublica: () => ({
    aprobar: { mutate: vi.fn(), isPending: false, isError: false, variables: undefined, error: null },
    rechazar: { mutate: vi.fn(), isPending: false, isError: false, variables: undefined, error: null },
  }),
}));
vi.mock('../components/org/InfoPublicaForm', () => ({ InfoPublicaForm: () => null }));

const referente = (id: number, nombre: string): Usuario => ({
  id, nombre, email: `${nombre.toLowerCase()}@test.com`, tipo: 'REFERENTE', activo: true,
});
const org = (id: number, nombre: string, referenteId: number | null): OrganizacionAdmin => ({
  id, nombre, slug: `org-${id}`, tipo: 'COMEDOR', descripcion: '', direccion: '',
  estado: referenteId == null ? 'SIN_RECLAMAR' : 'APROBADA', referenteId,
} as OrganizacionAdmin);

const ok = (data: unknown) => ({ data, isLoading: false, isError: false, isFetching: false });

describe('ReferentesPage (paginated organizaciones)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useUsuarios).mockReturnValue(
      ok(makePage([referente(1, 'Ana'), referente(2, 'Beto')])) as unknown as ReturnType<typeof useUsuarios>,
    );
    vi.mocked(useOrganizacionesAdmin).mockImplementation(((params: { sinReferente?: boolean }) =>
      params.sinReferente
        ? ok(makePage([org(30, 'Comedor Norte', null)], { totalElements: 2730, number: 0 }))
        : ok(makePage([org(10, 'Comedor Sol', 1), org(11, 'Merendero Luna', 1)]))
    ) as unknown as typeof useOrganizacionesAdmin);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderPage = () => render(<MemoryRouter><ReferentesPage /></MemoryRouter>);

  it('loads the orgs of the current page referentes in one bounded request and groups them', () => {
    renderPage();

    expect(useOrganizacionesAdmin).toHaveBeenCalledWith(
      { page: 0, size: 100, referenteIds: [1, 2] },
      { enabled: true },
    );
    expect(screen.getByText('Comedor Sol')).toBeInTheDocument();
    expect(screen.getByText('Merendero Luna')).toBeInTheDocument();
    expect(screen.getByText('No maneja ninguna organización.')).toBeInTheDocument();
  });

  it('shows the server total in the Sin referente title and one page of rows', () => {
    renderPage();

    expect(screen.getByText('Sin referente (2730)')).toBeInTheDocument();
    expect(screen.getByText('Comedor Norte')).toBeInTheDocument();
    expect(useOrganizacionesAdmin).toHaveBeenCalledWith({ page: 0, size: 20, sinReferente: true, q: '' });
  });

  it('debounces the org search into the q param and resets to the first page', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Buscar organización sin referente'), { target: { value: ' norte ' } });
    expect(useOrganizacionesAdmin).not.toHaveBeenCalledWith(expect.objectContaining({ q: 'norte' }));

    act(() => { vi.advanceTimersByTime(300); });

    expect(useOrganizacionesAdmin).toHaveBeenLastCalledWith({ page: 0, size: 20, sinReferente: true, q: 'norte' });
  });

  it('does not request referente orgs when the page has no referentes', () => {
    vi.mocked(useUsuarios).mockReturnValue(
      ok(makePage([])) as unknown as ReturnType<typeof useUsuarios>,
    );
    renderPage();

    expect(useOrganizacionesAdmin).toHaveBeenCalledWith(
      { page: 0, size: 100, referenteIds: [] },
      { enabled: false },
    );
  });
});
